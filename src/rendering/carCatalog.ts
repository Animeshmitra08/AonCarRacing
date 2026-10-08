/**
 * The cars a player can pick in the garage. Pure data (no asset imports), so the
 * network protocol and settings can reference cars by index without loading models.
 * The model files are mapped in rendering/three/loadCarAssets.ts.
 */
export const CAR_MODELS = [
  { id: "concept", name: "Concept GT", tagline: "Low-slung concept coupe" },
  { id: "stallion", name: "Stallion R", tagline: "Fastback muscle with a big wing" },
  { id: "raptor", name: "Raptor V10", tagline: "Mid-engine supercar" },
] as const;

export type CarModelId = (typeof CAR_MODELS)[number]["id"];

export function carModelAt(index: number): (typeof CAR_MODELS)[number] {
  const n = CAR_MODELS.length;
  return CAR_MODELS[((Math.floor(index) % n) + n) % n];
}
