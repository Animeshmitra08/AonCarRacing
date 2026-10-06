import { buildTrack, type Track, type TrackDefinition } from "@/game/entities/Track";

import { ALPINE_PASS } from "./alpinePass";
import { DESERT_SPEEDWAY } from "./desertSpeedway";
import { GREEN_VALLEY } from "./greenValley";

export const TRACKS: readonly TrackDefinition[] = [GREEN_VALLEY, DESERT_SPEEDWAY, ALPINE_PASS];

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
