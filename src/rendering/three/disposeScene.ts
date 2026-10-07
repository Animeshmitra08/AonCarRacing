import { InstancedMesh, Mesh, type Object3D } from "three";

import { SHARED_ASSET_FLAG } from "./carAsset";

/**
 * Frees GPU resources (geometries, materials, instance buffers) under `root`.
 * Shared car-model geometry is skipped: other cars and views still use it.
 */
export function disposeScene(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    if (!object.geometry.userData[SHARED_ASSET_FLAG]) object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material.dispose();
    if (object instanceof InstancedMesh) object.dispose();
  });
}
