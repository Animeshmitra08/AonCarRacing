import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, type BufferAttribute, type InterleavedBufferAttribute, type Mesh } from "three";

/**
 * Copies a mesh's geometry into its parent model's space (world matrix baked in) as
 * plain float position/normal(/color) + a uint32 index, so parts with different source
 * layouts can be merged with `mergeGeometries`.
 */
export function bakeMeshGeometry(mesh: Mesh, options: { withColor?: boolean } = {}): BufferGeometry {
  const source = mesh.geometry;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", toFloat32(source.getAttribute("position"), 3));
  const normal = source.getAttribute("normal");
  if (normal) geometry.setAttribute("normal", toFloat32(normal, 3));
  if (options.withColor) {
    const color = source.getAttribute("color");
    // Models without vertex colours render white, tinted by their material colour.
    geometry.setAttribute("color", color ? toFloat32(color, 3) : solidColor(source.getAttribute("position").count));
  }

  const count = source.getAttribute("position").count;
  const index = new Uint32Array(source.index ? source.index.count : count);
  for (let i = 0; i < index.length; i++) index[i] = source.index ? source.index.getX(i) : i;
  // A mirrored transform flips triangle winding; flip it back so back-face culling still works.
  if (mesh.matrixWorld.determinant() < 0) {
    for (let i = 0; i < index.length; i += 3) {
      const swap = index[i + 1];
      index[i + 1] = index[i + 2];
      index[i + 2] = swap;
    }
  }
  geometry.setIndex(new Uint32BufferAttribute(index, 1));
  geometry.applyMatrix4(mesh.matrixWorld);
  if (!normal) geometry.computeVertexNormals();
  return geometry;
}

/** Reads any layout (interleaved, normalized ints, vec4 colours) into float32 with `size` components. */
function toFloat32(attribute: BufferAttribute | InterleavedBufferAttribute, size: 3): Float32BufferAttribute {
  const out = new Float32Array(attribute.count * size);
  for (let i = 0; i < attribute.count; i++) {
    out[i * 3] = attribute.getX(i);
    out[i * 3 + 1] = attribute.getY(i);
    out[i * 3 + 2] = attribute.getZ(i);
  }
  return new Float32BufferAttribute(out, size);
}

function solidColor(count: number): Float32BufferAttribute {
  return new Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3);
}
