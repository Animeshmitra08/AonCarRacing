import { MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial, type Material } from "three";

import type { CarLook } from "@/rendering/carStyle";

import type { PartRole } from "./carAsset";

/**
 * Cheap mobile materials for each car part. Phong gives paint and chrome a glossy
 * highlight without the environment map that PBR metals need (they'd render black).
 */
export class CarMaterials {
  readonly paint = new MeshPhongMaterial({ shininess: 90, specular: 0x666666 });
  readonly accent = new MeshPhongMaterial({ shininess: 60, specular: 0x333333 });
  readonly rim = new MeshPhongMaterial({ shininess: 110, specular: 0x999999 });
  readonly caliper = new MeshPhongMaterial({ shininess: 40, specular: 0x444444 });
  private readonly fixed: Record<Exclude<PartRole, "paint" | "accent" | "rim" | "caliper" | "original">, Material> = {
    glass: new MeshPhongMaterial({ color: 0x0b121b, shininess: 120, specular: 0x8a9099 }),
    trim: new MeshLambertMaterial({ color: 0x0e0f10 }),
    mechanical: new MeshLambertMaterial({ color: 0x1b1c1e }),
    rimInner: new MeshLambertMaterial({ color: 0x121314 }),
    disc: new MeshLambertMaterial({ color: 0x6d7075 }),
    tire: new MeshLambertMaterial({ color: 0x141414 }),
    chrome: new MeshPhongMaterial({ color: 0xd0d4da, shininess: 120, specular: 0xaaaaaa }),
    headlight: new MeshBasicMaterial({ color: 0xeaf3ff }),
    taillight: new MeshBasicMaterial({ color: 0xff1a1a }),
    signal: new MeshBasicMaterial({ color: 0xff9a1a }),
  };
  private readonly originals = new Map<number, Material>();

  constructor(look: CarLook) {
    this.setLook(look);
  }

  setLook(look: CarLook): void {
    this.paint.color.set(look.paint);
    this.accent.color.set(look.accent);
    this.rim.color.set(look.rims);
    this.caliper.color.set(look.calipers);
  }

  forRole(role: PartRole, originalColor: number): Material {
    switch (role) {
      case "paint":
        return this.paint;
      case "accent":
        return this.accent;
      case "rim":
        return this.rim;
      case "caliper":
        return this.caliper;
      case "original": {
        let material = this.originals.get(originalColor);
        if (!material) {
          material = new MeshLambertMaterial({ color: originalColor });
          this.originals.set(originalColor, material);
        }
        return material;
      }
      default:
        return this.fixed[role];
    }
  }
}
