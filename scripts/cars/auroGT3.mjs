/** Lamborghini Auro GT3. Body exported as the +X half; wheels complete and named mycar-wheel.*. */
export default {
  input: "assets/models/car/LamborginiAuroGT3.glb",
  output: "assets/models/car/LamborginiAuroGT3.game.glb",
  forward: { marker: "Headlight glass" },
  /** Interior and engine bay: never visible through the opaque in-game glass. */
  removedNodes:
    /^(seat |Sport Seat|Dashboard|dashboard|HUD |Circle\.0(01|05|06|08|09|10)$|Cylinder$|Plane$|motor_01|lambo text engine|3D Lamborghini Text Logo|windshield\.002$)/,
  /** Alpha-textured stickers: without their texture they'd render as solid rectangles. */
  droppedMaterials: ["63", "lamborghini teste", "lamborghini_PNG10709", "noir", "OMP Jaune"],
  mirror: "bodyHalves",
  wheels: {
    mode: "nodes",
    /** The four tyres; every other wheel part is assigned to the nearest one. */
    tireNode: /^mycar-wheel\.(Ft|Bk)\.(L|R)$/,
    /** Rims, discs, hubs, nuts and brake hardware, when they sit at a wheel (body bolts don't). */
    partNode: /^(mycar-wheelbrake|Circle|Brake disc|Bolt|bolt|Nut|brake pads|line fluid link|metal (1)?\.)/,
    /** How close (m) a wheel part's centre must be to its wheel's centre. */
    partRadius: 0.3,
    /** Wheel parts with these materials form the caliper assembly. */
    isBrakeMaterial: (name) => name === "Calipers.001" || name.startsWith("1 car paint"),
  },
  roles: {
    // Body
    "Car Paint.001": "paint",
    "Car Paint.002": "paint",
    "Car Paint.003": "paint",
    "Car Paint.004": "paint",
    /** Livery overlay lying on the paint: any other colour would z-fight. */
    "Geometric pattern": "paint",
    "Carbon Fibre": "accent",
    "Carbon Fibre.001": "accent",
    "Mirror Paint": "accent",
    "1 car paint.002": "accent",
    "1 car paint.005": "accent",
    "Black plastic PL": "trim",
    "Black plastic PL.001": "trim",
    "Black plastic PL.003": "trim",
    "Plastic Base 01": "trim",
    "Plastic Base 01.001": "trim",
    "Dark Smooth plastic": "trim",
    "Black Paint": "trim",
    "light bloacker": "trim",
    "inside mesh": "trim",
    "Steel sheet perforated hexagonal": "trim",
    "Steel sheet perforated hexagonal.001": "trim",
    "Material.002": "trim",
    antenna: "trim",
    "black rubber": "trim",
    "Metal.001": "mechanical",
    "Metal05 PBR": "mechanical",
    "Metal05 PBR.001": "mechanical",
    "Aluminium rope": "mechanical",
    glass: "glass",
    "glass.001": "glass",
    "Glass side windows": "glass",
    "Textured Headlights glass": "headlight",
    "Polarized glass": "headlight",
    Emissive: "headlight",
    "Taillight glass": "taillight",
    "DRL Emission material PL": "taillight",
    Chrome: "chrome",
    "Chrome.001": "chrome",
    "chrome 2": "chrome",
    mirroir: "chrome",
    "Brushed Steel Mirror": "chrome",
    "Material.010": "chrome",
    "N arrow logo": "chrome",
    // Wheels
    "Tires.002": "tire",
    "Material.011": "rim",
    "Metal.003": "rimInner",
    "Metal.004": "rimInner",
    "Metal.005": "disc",
    "Bronze.001": "disc",
    "Nickel.001": "chrome",
    // Calipers (the rest of the caliper assembly is "mechanical")
    "Calipers.001": "caliper",
    "Blue paint": "caliper",
    "White Paint.001": "caliper",
    "Red Paint.001": "caliper",
  },
  /** Blender left these white; `null` keeps the file's colour. */
  fixedColors: {
    Red: "#c8102e",
    Green: "#009246",
    Blanc: "#f2f3ef",
    "Gold Paint": "#c9a227",
    "glossy plastic": null,
    "side tape": null,
    /** Tyre sidewall lettering. */
    "Material.003": null,
  },
  /** Wheels are small on screen, so they get a coarser budget than the body. */
  simplifyError: { body: 0.003, wheel: 0.006 },
};
