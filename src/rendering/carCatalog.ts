/**
 * The cars a player can pick in the garage. Pure data (no asset imports), so the
 * network protocol and settings can reference cars by index without loading models.
 * The model files are mapped in rendering/three/loadCarAssets.ts.
 */
export const CAR_MODELS = [
  // Index 0 is the default: saved settings and multiplayer refer to cars by index.
  { id: "auroGT3", name: "Auro GT3", tagline: "Mid-engine GT3 racer" },
  { id: "ferrari296GT3", name: "296 GT3", tagline: "Ferrari twin-turbo V6 racer" },
  { id: "revuelto", name: "Revuelto", tagline: "Lamborghini V12 hybrid supercar" },
  { id: "amgGT", name: "AMG GT", tagline: "Mercedes four-door grand tourer" },
] as const;

export type CarModelId = (typeof CAR_MODELS)[number]["id"];

export function carModelAt(index: number): (typeof CAR_MODELS)[number] {
  const n = CAR_MODELS.length;
  return CAR_MODELS[((Math.floor(index) % n) + n) % n];
}
