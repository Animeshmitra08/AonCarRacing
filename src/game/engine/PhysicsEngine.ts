import Matter from "matter-js";

import { CAR_BODY, CAR_DIMENSIONS, FIXED_DT_MS, MATTER_VELOCITY_TO_PX_PER_SEC, WALL_BODY } from "@/game/constants/PhysicsConstants";
import type { CarId } from "@/game/entities/Car";
import type { Track } from "@/game/entities/Track";
import type { Pose, Vec2 } from "@/game/math/geometry";

export type ImpactListener = (carId: CarId, impactSpeed: number) => void;

/**
 * Thin wrapper around Matter.js. Top-down, so no gravity.
 * Matter only resolves contacts; driving forces are set by CarController.
 */
export class PhysicsEngine {
  private readonly engine = Matter.Engine.create({ gravity: { x: 0, y: 0, scale: 0 } });
  private readonly carIdsByBodyId = new Map<number, CarId>();
  private impactListener: ImpactListener | null = null;

  constructor() {
    Matter.Events.on(this.engine, "collisionStart", this.handleCollisionStart);
  }

  step(): void {
    Matter.Engine.update(this.engine, FIXED_DT_MS);
  }

  setImpactListener(listener: ImpactListener | null): void {
    this.impactListener = listener;
  }

  createCarBody(carId: CarId, pose: Pose): Matter.Body {
    const body = Matter.Bodies.rectangle(pose.x, pose.y, CAR_DIMENSIONS.length, CAR_DIMENSIONS.width, {
      angle: pose.angle,
      density: CAR_BODY.density,
      friction: CAR_BODY.friction,
      frictionAir: 0,
      frictionStatic: 0,
      restitution: CAR_BODY.restitution,
      chamfer: { radius: CAR_BODY.chamferRadius },
      label: "car",
    });
    // Infinite inertia: collisions can't spin the car; CarController owns heading.
    Matter.Body.setInertia(body, Infinity);
    this.carIdsByBodyId.set(body.id, carId);
    Matter.Composite.add(this.engine.world, body);
    return body;
  }

  /** Builds static walls along both track edges. */
  addTrackWalls(track: Track): void {
    const walls: Matter.Body[] = [];
    addEdgeWalls(track.leftEdge, -1, walls);
    addEdgeWalls(track.rightEdge, 1, walls);
    Matter.Composite.add(this.engine.world, walls);
  }

  dispose(): void {
    Matter.Events.off(this.engine, "collisionStart", this.handleCollisionStart);
    Matter.Engine.clear(this.engine);
    this.carIdsByBodyId.clear();
  }

  private readonly handleCollisionStart = (event: Matter.IEventCollision<Matter.Engine>): void => {
    const listener = this.impactListener;
    if (!listener) return;
    for (const pair of event.pairs) {
      const { bodyA, bodyB } = pair;
      const { normal } = pair.collision;
      // Closing speed along the contact normal, in px/s.
      const relVx = bodyA.velocity.x - bodyB.velocity.x;
      const relVy = bodyA.velocity.y - bodyB.velocity.y;
      const impactSpeed = Math.abs(relVx * normal.x + relVy * normal.y) * MATTER_VELOCITY_TO_PX_PER_SEC;
      const carA = this.carIdsByBodyId.get(bodyA.id);
      const carB = this.carIdsByBodyId.get(bodyB.id);
      if (carA !== undefined) listener(carA, impactSpeed);
      if (carB !== undefined) listener(carB, impactSpeed);
    }
  };
}

/**
 * One rectangle per edge segment, pushed outward by half its thickness so the
 * inner face sits on the edge. `side` is -1 for the left edge, 1 for the right.
 */
function addEdgeWalls(edge: readonly Vec2[], side: -1 | 1, out: Matter.Body[]): void {
  const n = edge.length;
  const half = WALL_BODY.thickness / 2;
  for (let i = 0; i < n; i++) {
    const a = edge[i];
    const b = edge[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    const nx = (-dy / length) * side;
    const ny = (dx / length) * side;
    out.push(
      Matter.Bodies.rectangle(
        (a.x + b.x) / 2 + nx * half,
        (a.y + b.y) / 2 + ny * half,
        // Overlap neighbours slightly so there are no gaps on convex corners.
        length + WALL_BODY.thickness * 0.5,
        WALL_BODY.thickness,
        {
          isStatic: true,
          angle: Math.atan2(dy, dx),
          friction: WALL_BODY.friction,
          restitution: WALL_BODY.restitution,
          label: "wall",
        },
      ),
    );
  }
}
