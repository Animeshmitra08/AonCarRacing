import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  type Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * A low-beam headlight: a wide, flat cone aimed slightly down and outward. Shared by the
 * visible beam and the light it casts on the road, so the two line up.
 */
const BEAM = {
  /** Downward pitch of the beam's axis (radians). */
  tilt: 0.05,
  /** Outward aim of each lamp (radians): the two beams spread to light the road edges. */
  toe: 0.05,
  /** Half-angles of the cone (radians): low beams are much wider than they are tall. */
  halfWidth: 0.34,
  halfHeight: 0.11,
  /** Visible beam in the air: faint, as in daylight. */
  length: 7,
  segments: 20,
  opacity: 0.12,
} as const;
/** The pool of light the beams cast on the road. */
const POOL = {
  /** Just above the road's lane markings (see TRACK_3D.markY). */
  y: 0.05,
  /** How far ahead of the lamps it's computed (m), and how wide. */
  length: 20,
  halfWidth: 7,
  /** Grid resolution: along the road, across it. */
  rows: 28,
  columns: 18,
  /** Brightest point's added light (0..1), and contrast: < 1 lifts the dim far end. */
  peak: 0.5,
  gamma: 0.6,
  /** Fraction of the length over which it fades out at the far end. */
  fadeOut: 0.3,
} as const;
const GLOW = {
  headSize: 0.6,
  tailSize: 0.55,
  /** Pushes each glow out of its lamp so the body doesn't hide it (m). */
  offset: 0.06,
  tailColor: "#ff1a1a",
} as const;
/** Per second: beams ease in and out, brake lights snap on. */
const FADE_RATE = { beam: 6, brake: 20 } as const;

const GLOW_VERTEX_SHADER = /* glsl */ `
  attribute vec3 center;
  uniform float size;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Billboard: offset the quad's corners in view space so it always faces the camera.
    vec4 mvPosition = modelViewMatrix * vec4(center, 1.0);
    mvPosition.xy += position.xy * size;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const GLOW_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 color;
  uniform float intensity;
  varying vec2 vUv;
  void main() {
    // Soft round glow from the quad's own coordinates: no texture needed.
    float d = length(vUv - 0.5) * 2.0;
    float glow = intensity * pow(max(0.0, 1.0 - d), 2.0);
    gl_FragColor = vec4(color * glow, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * Headlights while accelerating (a faint beam in the air, light on the road ahead, a glow
 * on each lamp) and brake-light glow while braking. Additive and unlit, so they read as
 * light without real light sources (too costly for 8 cars on a phone). `object` goes under
 * the car body (it rolls with it); `ground` goes under the car root (it stays level).
 */
export class CarLights {
  readonly object = new Group();
  readonly ground: Mesh;
  /** 0..1, eased; also drives the tail lamp material (see `CarMaterials.setBrakeLight`). */
  brake = 0;
  private beam = 0;
  private readonly beamMaterial = createLightMaterial();
  private readonly poolMaterial = createLightMaterial();
  private readonly beams: Mesh;
  private readonly headGlow: Mesh<BufferGeometry, ShaderMaterial>;
  private readonly tailGlow: Mesh<BufferGeometry, ShaderMaterial>;

  constructor(head: readonly Vector3[], tail: readonly Vector3[], lightColor: string) {
    this.beams = new Mesh(createBeamGeometry(head), this.beamMaterial);
    this.ground = new Mesh(createPoolGeometry(head), this.poolMaterial);
    this.headGlow = createGlow(head, GLOW.offset, GLOW.headSize);
    this.tailGlow = createGlow(tail, -GLOW.offset, GLOW.tailSize);
    this.tailGlow.material.uniforms.color.value.set(GLOW.tailColor);
    for (const mesh of [this.beams, this.headGlow, this.tailGlow]) this.object.add(mesh);
    for (const mesh of [this.beams, this.ground, this.headGlow, this.tailGlow]) mesh.visible = false;
    this.setColor(lightColor);
  }

  /** Headlight colour (tail lights stay red). */
  setColor(color: string): void {
    this.beamMaterial.color.set(color);
    this.poolMaterial.color.set(color);
    this.headGlow.material.uniforms.color.value.set(color);
  }

  update(accelerating: boolean, braking: boolean, dt: number): void {
    this.beam = approach(this.beam, accelerating ? 1 : 0, FADE_RATE.beam * dt);
    this.brake = approach(this.brake, braking ? 1 : 0, FADE_RATE.brake * dt);
    this.beamMaterial.opacity = this.beam * BEAM.opacity;
    this.poolMaterial.opacity = this.beam;
    this.headGlow.material.uniforms.intensity.value = this.beam;
    this.tailGlow.material.uniforms.intensity.value = this.brake;
    this.beams.visible = this.ground.visible = this.headGlow.visible = this.beam > 0;
    this.tailGlow.visible = this.brake > 0;
  }
}

function approach(value: number, target: number, step: number): number {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}

/** Unlit, additive, brightness from vertex colours: black adds nothing, so edges fade out. */
function createLightMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
  });
}

/** Each lamp's aim across the road (radians, +z positive): toed out toward its own side. */
function aimOf(lamp: Vector3): number {
  return BEAM.toe * Math.sign(lamp.z);
}

/**
 * One open elliptical cone per lamp along its aim, apex at the lamp, fading out with
 * distance. Its lower part dips under the road and is hidden there, so the beam
 * visibly lands on the street where the light pool is.
 */
function createBeamGeometry(lamps: readonly Vector3[]): BufferGeometry {
  const cones = lamps.map((lamp) => {
    // ConeGeometry has its apex on +y: move the apex to the origin and swing -y onto +x.
    // The cross-section is then in y (up) and z (across), with radius 1 at the far end.
    const cone = new ConeGeometry(1, BEAM.length, BEAM.segments, 4, true)
      .translate(0, -BEAM.length / 2, 0)
      .rotateZ(Math.PI / 2);
    const position = cone.getAttribute("position");
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      colors.fill((1 - position.getX(i) / BEAM.length) ** 2, i * 3, i * 3 + 3);
    }
    cone.setAttribute("color", new Float32BufferAttribute(colors, 3));
    // mergeGeometries needs matching attributes; the beam is unlit.
    cone.deleteAttribute("normal");
    cone.deleteAttribute("uv");
    return cone
      .scale(1, BEAM.length * Math.tan(BEAM.halfHeight), BEAM.length * Math.tan(BEAM.halfWidth))
      .rotateZ(-BEAM.tilt)
      .rotateY(-aimOf(lamp))
      .translate(lamp.x, lamp.y, lamp.z);
  });
  return (cones.length > 0 && mergeGeometries(cones)) || new BufferGeometry();
}

/**
 * The light the headlights cast on the road, baked into a grid's vertex colours.
 * Each point gets the illuminance from every lamp: the beam's intensity in that
 * direction × cos(incidence) / distance², the way a real lamp lights a surface.
 * Near the car the road is below the beam's lower edge; far away the light spreads
 * thin and hits at a grazing angle, so the pool is brightest a few metres ahead.
 */
function createPoolGeometry(lamps: readonly Vector3[]): BufferGeometry {
  const geometry = new BufferGeometry();
  if (lamps.length === 0) return geometry;
  const startX = Math.max(...lamps.map((lamp) => lamp.x));
  const { rows, columns } = POOL;
  const positions: number[] = [];
  const illuminance: number[] = [];
  const along: number[] = [];
  for (let row = 0; row < rows; row++) {
    // Rows bunch up near the car, where the light changes fastest.
    const t = row / (rows - 1);
    const x = startX + POOL.length * t ** 1.6;
    for (let column = 0; column < columns; column++) {
      const z = POOL.halfWidth * ((2 * column) / (columns - 1) - 1);
      positions.push(x, POOL.y, z);
      illuminance.push(lamps.reduce((sum, lamp) => sum + illuminanceAt(lamp, x, z), 0));
      along.push(t);
    }
  }

  // Normalise to the brightest point, compress the range, fade out the far edge.
  const brightest = Math.max(...illuminance) || 1;
  const colors = new Float32Array(illuminance.length * 3);
  illuminance.forEach((e, i) => {
    const farFade = smoothstep(1, 1 - POOL.fadeOut, along[i]);
    colors.fill(POOL.peak * (e / brightest) ** POOL.gamma * farFade, i * 3, i * 3 + 3);
  });

  const indices: number[] = [];
  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const a = row * columns + column;
      const b = a + columns;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}

/** Illuminance from one lamp at road point (x, POOL.y, z), in arbitrary units. */
function illuminanceAt(lamp: Vector3, x: number, z: number): number {
  const dx = x - lamp.x;
  const dy = POOL.y - lamp.y;
  const dz = z - lamp.z;
  if (dx <= 0 || dy >= 0) return 0;
  // Angles off the beam's axis, across and up/down.
  const across = Math.atan2(dz, dx) - aimOf(lamp);
  const updown = Math.atan2(dy, Math.hypot(dx, dz)) + BEAM.tilt;
  const r2 = (across / BEAM.halfWidth) ** 2 + (updown / BEAM.halfHeight) ** 2;
  if (r2 >= 1) return 0;
  // Bright core, soft edge.
  const intensity = (1 - r2) ** 2;
  const distance2 = dx * dx + dy * dy + dz * dz;
  const cosIncidence = -dy / Math.sqrt(distance2);
  return (intensity * cosIncidence) / distance2;
}

/** 0 at `edge0`, 1 at `edge1`, smooth in between (either order). */
function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** One camera-facing glow quad per lamp, `offset` metres out along x from it. */
function createGlow(lamps: readonly Vector3[], offset: number, size: number): Mesh<BufferGeometry, ShaderMaterial> {
  const positions: number[] = [];
  const uvs: number[] = [];
  const centers: number[] = [];
  const indices: number[] = [];
  lamps.forEach((lamp, i) => {
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      positions.push(u - 0.5, v - 0.5, 0);
      uvs.push(u, v);
      centers.push(lamp.x + offset, lamp.y, lamp.z);
    }
    const base = i * 4;
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("center", new Float32BufferAttribute(centers, 3));
  geometry.setIndex(indices);
  const material = new ShaderMaterial({
    uniforms: { color: { value: new Color() }, intensity: { value: 0 }, size: { value: size } },
    vertexShader: GLOW_VERTEX_SHADER,
    fragmentShader: GLOW_FRAGMENT_SHADER,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new Mesh(geometry, material);
  // The quads are placed in the shader; the geometry's own bounds are meaningless.
  mesh.frustumCulled = false;
  return mesh;
}
