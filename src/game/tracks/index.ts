import { buildTrack, type Track, type TrackDefinition } from "@/game/entities/Track";

import { ALPINE_PASS } from "./alpinePass";
import { DESERT_SPEEDWAY } from "./desertSpeedway";
import { GLACIER_SWITCHBACKS } from "./glacierSwitchbacks";
import { GREEN_VALLEY } from "./greenValley";
import { LAKESIDE_SPRINT } from "./lakesideSprint";
import { SUNSET_CANYON } from "./sunsetCanyon";

export const TRACKS: readonly TrackDefinition[] = [
  GREEN_VALLEY,
  DESERT_SPEEDWAY,
  ALPINE_PASS,
  LAKESIDE_SPRINT,
  SUNSET_CANYON,
  GLACIER_SWITCHBACKS,
];

export function findTrack(id: string): TrackDefinition {
  return TRACKS.find((track) => track.id === id) ?? TRACKS[0];
}

const builtTracks = new Map<string, Track>();

/** Built geometry, cached — for menus/previews. The engine builds its own copy. */
export function getBuiltTrack(definition: TrackDefinition): Track {
  let track = builtTracks.get(definition.id);
  if (!track) {
    track = buildTrack(definition);
    builtTracks.set(definition.id, track);
  }
  return track;
}
