/** Mercedes-AMG GT. Body exported as the +X half; wheels and calipers complete (mycar-wheel*). */
export default {
  input: "assets/models/car/MercedesBenzAMZGT.glb",
  output: "assets/models/car/MercedesBenzAMZGT.game.glb",
  forward: "+z",
  /** Stray template parts: an antenna tip floating above the roof, a plate inside the cabin. */
  removedNodes: /^(roof\.004|panels\.035)$/,
  /** Bulbs, LED matrix and wiring behind the opaque headlight glass. */
  droppedMaterials: ["glass HL LED Matrice", "copper plate HL", "chrome 2.002", "glass light Bulb HL", "HL Bulb Glow", "cables HL"],
  mirror: "unpaired",
  /** Wheels and calipers exist on both sides; the calipers sit at different angles left and right. */
  mirrorWheels: false,
  wheels: { mode: "materials", tire: ["tyre", "tyre side wall"], spin: ["rims", "gril"], brake: ["red clipper"] },
  roles: {
    "Black Carpaint": "paint",
    plastic: "trim",
    gril: "trim",
    "black button": "trim",
    wind: "glass",
    "Head Light Led Tube": "headlight",
    "HeadLight Glass": "headlight",
    "Tailight Led Tube": "taillight",
    "Tailight Led Tube.001": "taillight",
    indicatores: "signal",
    mirror: "chrome",
    chrome: "chrome",
    logo: "chrome",
    "mercedes logo": "chrome",
    tyre: "tire",
    "tyre side wall": "tire",
    rims: "rim",
    "red clipper": "caliper",
  },
  wheelRoles: { gril: "rimInner" },
  /** The body is one material: pick out the roof, mirror caps, sills and rear wing for the accent colour. */
  nodeRoles: {
    "Cube.021": "accent",
    "Cube.037": "accent",
    "Cube.049": "accent",
    "Cube.011": "accent",
    "Cube.059": "accent",
    "Cube.060": "accent",
    /** Mirror indicator lens (in the headlight glass material). */
    "Cube.038": "signal",
  },
  fixedColors: {},
  /** The tail lamps use the "HeadLight Glass" material too. */
  lampsByPosition: true,
  simplifyError: { body: 0.003, wheel: 0.006 },
};
