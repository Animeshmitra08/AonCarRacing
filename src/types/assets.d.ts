/** Metro resolves binary assets to a module id for expo-asset (see metro.config.js). */
declare module "*.glb" {
  const asset: number;
  export default asset;
}
