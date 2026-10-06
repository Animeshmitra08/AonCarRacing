import { Skia, type SkPath } from "@shopify/react-native-skia";

import type { Track } from "@/game/entities/Track";

export interface OutlineTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface TrackOutline {
  transform: OutlineTransform;
  /** Centerline in canvas coordinates; stroke it with `roadWidth`. */
  path: SkPath;
  roadWidth: number;
}

const MIN_ROAD_WIDTH = 3;

/** Fits a north-up 2D outline of the track into a `width`×`height` canvas. */
export function createTrackOutline(track: Track, width: number, height: number, padding: number): TrackOutline {
  const { minX, minY, maxX, maxY } = track.bounds;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const scale = Math.min(innerW / (maxX - minX), innerH / (maxY - minY));
  const transform: OutlineTransform = {
    scale,
    offsetX: padding + (innerW - (maxX - minX) * scale) / 2 - minX * scale,
    offsetY: padding + (innerH - (maxY - minY) * scale) / 2 - minY * scale,
  };
  const points = track.centerline.map((p) => ({
    x: p.x * scale + transform.offsetX,
    y: p.y * scale + transform.offsetY,
  }));
  return {
    transform,
    path: Skia.PathBuilder.Make().addPoly(points, true).detach(),
    roadWidth: Math.max(MIN_ROAD_WIDTH, track.halfWidth * 2 * scale),
  };
}
