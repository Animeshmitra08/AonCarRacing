/**
 * Lamborghini Revuelto. Mirrored halves are scattered: body and rims exported on -X,
 * tyres on +X, and each axle's two brake discs are one mesh. No wheel node names.
 */
export default {
  input: "assets/models/car/LamborginiRevuelto.glb",
  output: "assets/models/car/LamborginiRevuelto.game.glb",
  forward: "+z",
  /** Seats, dashboard, screens and door cards (hidden behind the opaque glass); a stray antenna tip. */
  removedNodes: /^(AM-Lamborghini Revuelto\.(0(19|[2-8]\d|9[0-2])|125|127)|roof\.004)$/,
  droppedMaterials: [],
  mirror: "unpaired",
  wheels: { mode: "materials", tire: ["Tire02"], spin: ["Smooth Metal", "Anisotropic Metal"], brake: [] },
  roles: {
    "The-Best-CarPiant-amj": "paint",
    "Carbon Fiber": "accent",
    "Gloss-black": "trim",
    "Rough-Rubber": "trim",
    Diffuse: "trim",
    Plastic: "trim",
    Interior_black: "trim",
    "": "trim",
    "Metal Rough": "mechanical",
    "Anisotropic Metal": "mechanical",
    "Windows.001": "glass",
    Headlight: "headlight",
    White: "headlight",
    Lens: "headlight",
    "Red Emission": "taillight",
    Taillight_glass: "taillight",
    "back-light-tex": "taillight",
    red: "taillight",
    "Rough-Chr": "chrome",
    "Chrome.002": "chrome",
    "Logo Front": "chrome",
    "Smooth Metal": "chrome",
    /** Exhaust tips. */
    Wheel: "chrome",
    Tire02: "tire",
  },
  wheelRoles: { "Smooth Metal": "rim", "Anisotropic Metal": "disc" },
  fixedColors: {},
  /** The rear lamp housings use the "Headlight" material too. */
  lampsByPosition: true,
  simplifyError: { body: 0.003, wheel: 0.006 },
};
