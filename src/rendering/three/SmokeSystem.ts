import { BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial } from "three";

import { CAR_DIMENSIONS, DEFAULT_CAR_TUNING } from "@/game/constants/PhysicsConstants";
import { clamp } from "@/game/math/geometry";
import { METERS_PER_WORLD_UNIT as S } from "@/rendering/RenderConstants";

const SMOKE = {
  /** Shared by every car; the oldest puff is recycled when full. */
  poolSize: 256,
  /** Puffs per second per car at full intensity. */
  maxRate: 60,
  color: "#d9d9d6",
  startAlpha: 0.42,
  startSize: 0.55,
  endSize: 2.4,
  minLife: 0.8,
  maxLife: 1.35,
  /** Metres per second. */
  backSpeed: 1.6,
  spreadSpeed: 0.9,
  riseSpeed: 0.9,
  drag: 1.8,
  emitHeight: 0.18,
  /** Rear wheel position as fractions of car length/width (car space, +x forward). */
  rearAxle: -0.33,
  wheelTrack: 0.4,
  /** How quickly the acceleration estimate follows the car (per second). */
  accelSmoothing: 8,
  /** Fraction of smoke left at top speed: most smoke is on launch. */
  topSpeedSmoke: 0.25,
  boostSmoke: 0.55,
} as const;

const VERTEX_SHADER = /* glsl */ `
  attribute float size;
  attribute float alpha;
  uniform float pointScale;
  varying float vAlpha;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * pointScale / -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = alpha;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 color;
  varying float vAlpha;
  void main() {
    // Soft round puff from the point sprite's own coordinates: no texture needed.
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = vAlpha * smoothstep(1.0, 0.15, d);
    if (a < 0.01) discard;
    gl_FragColor = vec4(color, a);
  }
`;

interface Emitter {
  prevSpeed: number;
  accel: number;
  /** Fractional puffs carried between frames. */
  pending: number;
  nextWheel: number;
  initialized: boolean;
}

/**
 * Exhaust/tyre smoke behind accelerating cars: a fixed pool of point sprites drawn
 * in one call. Intensity comes from each car's measured acceleration, so it works
 * the same for local, remote (multiplayer) and AI cars without extra state.
 */
export class SmokeSystem {
  readonly object: Points;
  private readonly positions = new Float32Array(SMOKE.poolSize * 3);
  private readonly sizes = new Float32Array(SMOKE.poolSize);
  private readonly alphas = new Float32Array(SMOKE.poolSize);
  private readonly velocities = new Float32Array(SMOKE.poolSize * 3);
  private readonly ages = new Float32Array(SMOKE.poolSize);
  private readonly lives = new Float32Array(SMOKE.poolSize);
  private readonly material: ShaderMaterial;
  private readonly emitters: Emitter[];
  private cursor = 0;

  constructor(carCount: number) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    geometry.setAttribute("size", new BufferAttribute(this.sizes, 1));
    geometry.setAttribute("alpha", new BufferAttribute(this.alphas, 1));
    this.material = new ShaderMaterial({
      uniforms: { color: { value: new Color(SMOKE.color) }, pointScale: { value: 1 } },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
    });
    this.object = new Points(geometry, this.material);
    // Puffs are scattered over the whole track; bounds would be stale every frame.
    this.object.frustumCulled = false;
    this.emitters = Array.from({ length: carCount }, () => ({
      prevSpeed: 0,
      accel: 0,
      pending: 0,
      nextWheel: 0,
      initialized: false,
    }));
  }

  /**
   * Call once per frame per car. Position in scene metres, `heading` radians (2D world),
   * `forwardSpeed` world units/s.
   */
  emitFromCar(index: number, x: number, z: number, heading: number, forwardSpeed: number, boosting: boolean, dt: number): void {
    const emitter = this.emitters[index];
    if (!emitter || dt <= 0) return;
    if (!emitter.initialized) {
      emitter.prevSpeed = forwardSpeed;
      emitter.initialized = true;
    }
    const measured = (forwardSpeed - emitter.prevSpeed) / dt;
    emitter.prevSpeed = forwardSpeed;
    emitter.accel += (measured - emitter.accel) * (1 - Math.exp(-SMOKE.accelSmoothing * dt));

    const tuning = DEFAULT_CAR_TUNING;
    const speedRatio = clamp(Math.abs(forwardSpeed) / tuning.maxForwardSpeed, 0, 1);
    const launch = 1 - (1 - SMOKE.topSpeedSmoke) * speedRatio;
    let intensity = forwardSpeed >= 0 ? clamp(emitter.accel / tuning.acceleration, 0, 1) * launch : 0;
    if (boosting) intensity = Math.max(intensity, SMOKE.boostSmoke);
    if (intensity <= 0.02) {
      emitter.pending = 0;
      return;
    }

    emitter.pending += SMOKE.maxRate * intensity * dt;
    const cos = Math.cos(heading);
    const sin = Math.sin(heading);
    const length = CAR_DIMENSIONS.length * S;
    const width = CAR_DIMENSIONS.width * S;
    while (emitter.pending >= 1) {
      emitter.pending -= 1;
      // Alternate rear wheels. Car space (lx forward, lz right) → scene (x, z).
      const lx = length * SMOKE.rearAxle;
      const lz = width * SMOKE.wheelTrack * (emitter.nextWheel === 0 ? -1 : 1);
      emitter.nextWheel = 1 - emitter.nextWheel;
      this.spawn(x + lx * cos - lz * sin, z + lx * sin + lz * cos, -cos, -sin, intensity);
    }
  }

  /** Ages and moves every puff; call once per frame after emitting. */
  update(dt: number, viewportHeight: number, fovDegrees: number): void {
    const damping = Math.exp(-SMOKE.drag * dt);
    for (let i = 0; i < SMOKE.poolSize; i++) {
      if (this.lives[i] <= 0) continue;
      this.ages[i] += dt;
      const t = this.ages[i] / this.lives[i];
      if (t >= 1) {
        this.lives[i] = 0;
        this.alphas[i] = 0;
        this.sizes[i] = 0;
        continue;
      }
      const v = i * 3;
      this.velocities[v] *= damping;
      this.velocities[v + 2] *= damping;
      this.positions[v] += this.velocities[v] * dt;
      this.positions[v + 1] += this.velocities[v + 1] * dt;
      this.positions[v + 2] += this.velocities[v + 2] * dt;
      this.sizes[i] = SMOKE.startSize + (SMOKE.endSize - SMOKE.startSize) * Math.sqrt(t);
      this.alphas[i] = SMOKE.startAlpha * (1 - t) * (1 - t);
    }
    const geometry = this.object.geometry;
    geometry.getAttribute("position").needsUpdate = true;
    geometry.getAttribute("size").needsUpdate = true;
    geometry.getAttribute("alpha").needsUpdate = true;
    // Convert world-size puffs to pixels for the current projection.
    this.material.uniforms.pointScale.value = viewportHeight / (2 * Math.tan((fovDegrees * Math.PI) / 360));
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.material.dispose();
  }

  private spawn(x: number, z: number, backX: number, backZ: number, intensity: number): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % SMOKE.poolSize;
    const v = i * 3;
    const spreadX = (Math.random() - 0.5) * 2 * SMOKE.spreadSpeed;
    const spreadZ = (Math.random() - 0.5) * 2 * SMOKE.spreadSpeed;
    const back = SMOKE.backSpeed * (0.6 + Math.random() * 0.8);
    this.positions[v] = x;
    this.positions[v + 1] = SMOKE.emitHeight;
    this.positions[v + 2] = z;
    this.velocities[v] = backX * back + spreadX;
    this.velocities[v + 1] = SMOKE.riseSpeed * (0.6 + Math.random() * 0.8);
    this.velocities[v + 2] = backZ * back + spreadZ;
    this.ages[i] = 0;
    // Heavier smoke lingers longer.
    this.lives[i] = SMOKE.minLife + (SMOKE.maxLife - SMOKE.minLife) * (0.4 * Math.random() + 0.6 * intensity);
    this.sizes[i] = SMOKE.startSize;
    this.alphas[i] = SMOKE.startAlpha;
  }
}
