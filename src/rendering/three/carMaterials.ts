import { Color, MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial, type Material } from "three";

import type { CarLook } from "@/rendering/carStyle";

import type { PartRole } from "./carAsset";

type CustomRole = "paint" | "accent" | "trim" | "rim" | "caliper" | "glass" | "headlight";

/** Tail lamps: dim red while driving, bright when braking. */
const TAILLIGHT = { off: new Color(0x5a0808), braking: new Color(0xff1a1a) } as const;

/**
 * Cheap mobile materials for each car part. Phong gives paint, chrome and glass a
 * glossy highlight without the environment map that PBR metals need (they'd render black).
 * The player-customisable ones are recoloured in place by `setLook`.
 */
export class CarMaterials {
  readonly paint = new MeshPhongMaterial({ shininess: 90, specular: 0x666666 });
  private readonly custom: Record<Exclude<CustomRole, "paint">, MeshPhongMaterial | MeshBasicMaterial> = {
    accent: new MeshPhongMaterial({ shininess: 60, specular: 0x333333 }),
    trim: new MeshPhongMaterial({ shininess: 50, specular: 0x333333 }),
    rim: new MeshPhongMaterial({ shininess: 110, specular: 0x999999 }),
    caliper: new MeshPhongMaterial({ shininess: 40, specular: 0x444444 }),
    glass: new MeshPhongMaterial({ shininess: 120, specular: 0x8a9099 }),
    headlight: new MeshBasicMaterial(),
  };
  private readonly taillight = new MeshBasicMaterial({ color: TAILLIGHT.off });
  private readonly fixed: Record<Exclude<PartRole, CustomRole | "original">, Material> = {
    mechanical: new MeshLambertMaterial({ color: 0x1b1c1e }),
    rimInner: new MeshLambertMaterial({ color: 0x121314 }),
    disc: new MeshLambertMaterial({ color: 0x6d7075 }),
    tire: new MeshLambertMaterial({ color: 0x141414 }),
    chrome: new MeshPhongMaterial({ color: 0xd0d4da, shininess: 120, specular: 0xaaaaaa }),
    taillight: this.taillight,
    signal: new MeshBasicMaterial({ color: 0xff9a1a }),
  };
  private readonly originals = new Map<number, Material>();

  constructor(look: CarLook) {
    this.setLook(look);
  }

  get accent(): Material {
    return this.custom.accent;
  }

  setLook(look: CarLook): void {
    this.paint.color.set(look.paint);
    this.custom.accent.color.set(look.accent);
    this.custom.trim.color.set(look.trim);
    this.custom.rim.color.set(look.rims);
    this.custom.caliper.color.set(look.calipers);
    this.custom.glass.color.set(look.glass);
    this.custom.headlight.color.set(look.lights);
  }

  /** `level` 0 (off) .. 1 (braking). */
  setBrakeLight(level: number): void {
    this.taillight.color.lerpColors(TAILLIGHT.off, TAILLIGHT.braking, level);
  }

  forRole(role: PartRole, originalColor: number): Material {
    if (role === "paint") return this.paint;
    if (role === "original") {
      let material = this.originals.get(originalColor);
      if (!material) {
        material = new MeshLambertMaterial({ color: originalColor });
        this.originals.set(originalColor, material);
      }
      return material;
    }
    return role in this.custom ? this.custom[role as Exclude<CustomRole, "paint">] : this.fixed[role as keyof typeof this.fixed];
  }
}
