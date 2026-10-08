import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { loadAsync } from "expo-font";

import { getBuiltTrack, TRACKS } from "@/game/tracks";
import { loadCarAssets } from "@/rendering/three/loadCarAssets";
import { loadSceneryModels } from "@/rendering/three/scenery/loadSceneryModels";

import { loadPlayerData, type PlayerData } from "./loadPlayerData";

/** `fraction` 0..1 across everything; `label` describes the current step. */
export type ProgressListener = (fraction: number, label: string) => void;

interface LoadingTask {
  /** Share of the progress bar this task fills. */
  weight: number;
  run(report: (fraction: number, label: string) => void): Promise<unknown>;
}

const TASKS: readonly LoadingTask[] = [
  {
    weight: 1,
    // Preloaded so tab and control icons don't pop in after the first render.
    run: async (report) => {
      report(0, "Loading icons");
      await loadAsync({ ...Ionicons.font, ...MaterialCommunityIcons.font });
    },
  },
  {
    weight: 4,
    run: (report) => loadCarAssets(report),
  },
  {
    weight: 2,
    run: (report) => loadSceneryModels(report),
  },
  {
    weight: 1,
    // Track geometry is cached and reused by the map cards and every race.
    run: async (report) => {
      for (let i = 0; i < TRACKS.length; i++) {
        report(i / TRACKS.length, `Building ${TRACKS[i].name}`);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        getBuiltTrack(TRACKS[i]);
      }
    },
  },
];

/** Saved profile/settings/scores are read first so they're ready the moment the app shows. */
const PLAYER_DATA_WEIGHT = 1;

/**
 * Loads everything the game needs before the first screen. Never rejects: a failed
 * step is skipped (fonts then load lazily; cars fall back to the low-poly model;
 * unreadable saved data becomes defaults).
 */
export async function loadGameAssets(onProgress: ProgressListener): Promise<PlayerData> {
  const total = PLAYER_DATA_WEIGHT + TASKS.reduce((sum, task) => sum + task.weight, 0);
  onProgress(0, "Loading your profile");
  const playerData = await loadPlayerData();
  let done = PLAYER_DATA_WEIGHT;
  onProgress(done / total, "Loading your profile");

  for (const task of TASKS) {
    const report = (fraction: number, label: string) =>
      onProgress((done + task.weight * Math.min(1, Math.max(0, fraction))) / total, label);
    try {
      await task.run(report);
    } catch (error) {
      console.warn("Loading step failed; continuing.", error);
    }
    done += task.weight;
    onProgress(done / total, "Ready");
  }
  return playerData;
}
