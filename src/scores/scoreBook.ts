import { MAX_VALUE_BYTES, utf8Length } from "@/storage/limits";

/** Personal records for one track. Times are simulation ticks. */
export interface TrackRecord {
  bestLapTicks: number | null;
  /** Best total race time per lap count (a 3-lap time isn't comparable to a 5-lap one). */
  bestRaceTicks: Record<string, number>;
  racesFinished: number;
  /** Multiplayer races won against at least one other driver. */
  wins: number;
}

export interface RaceResult {
  trackId: string;
  laps: number;
  mode: "solo" | "multiplayer";
  /** Null = did not finish. */
  totalTicks: number | null;
  bestLapTicks: number | null;
  position: number | null;
  racers: number;
  at: number;
}

export interface ScoreBook {
  tracks: Record<string, TrackRecord>;
  /** Newest first. */
  recent: RaceResult[];
}

export interface RecordOutcome {
  newBestLap: boolean;
  newBestRace: boolean;
}

const MAX_RECENT = 8;

export function emptyScoreBook(): ScoreBook {
  return { tracks: {}, recent: [] };
}

function emptyTrackRecord(): TrackRecord {
  return { bestLapTicks: null, bestRaceTicks: {}, racesFinished: 0, wins: 0 };
}

/** Returns the updated book (never mutates) and whether any personal best was set. */
export function recordResult(book: ScoreBook, result: RaceResult): { book: ScoreBook; outcome: RecordOutcome } {
  const previous = book.tracks[result.trackId] ?? emptyTrackRecord();
  const lapKey = String(result.laps);
  const previousRace = previous.bestRaceTicks[lapKey];
  const newBestLap =
    result.bestLapTicks !== null && (previous.bestLapTicks === null || result.bestLapTicks < previous.bestLapTicks);
  const newBestRace = result.totalTicks !== null && (previousRace === undefined || result.totalTicks < previousRace);

  const record: TrackRecord = {
    bestLapTicks: newBestLap ? result.bestLapTicks : previous.bestLapTicks,
    bestRaceTicks: newBestRace ? { ...previous.bestRaceTicks, [lapKey]: result.totalTicks! } : previous.bestRaceTicks,
    racesFinished: previous.racesFinished + (result.totalTicks !== null ? 1 : 0),
    wins: previous.wins + (result.mode === "multiplayer" && result.position === 1 && result.racers > 1 ? 1 : 0),
  };
  const updated: ScoreBook = {
    tracks: { ...book.tracks, [result.trackId]: record },
    recent: [result, ...book.recent].slice(0, MAX_RECENT),
  };
  return { book: fitStorageLimit(updated), outcome: { newBestLap, newBestRace } };
}

/** Drops the oldest recent results until the JSON fits secure storage's size limit. */
export function fitStorageLimit(book: ScoreBook): ScoreBook {
  let fitted = book;
  while (utf8Length(JSON.stringify(fitted)) > MAX_VALUE_BYTES && fitted.recent.length > 0) {
    fitted = { ...fitted, recent: fitted.recent.slice(0, -1) };
  }
  return fitted;
}

export function totals(book: ScoreBook): { racesFinished: number; wins: number } {
  return Object.values(book.tracks).reduce(
    (sum, t) => ({ racesFinished: sum.racesFinished + t.racesFinished, wins: sum.wins + t.wins }),
    { racesFinished: 0, wins: 0 },
  );
}

// ---- Validation of stored data ----

const isTicks = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

export function parseScoreBook(value: unknown): ScoreBook {
  if (typeof value !== "object" || value === null) return emptyScoreBook();
  const { tracks, recent } = value as Record<string, unknown>;
  const book = emptyScoreBook();

  if (typeof tracks === "object" && tracks !== null) {
    for (const [trackId, raw] of Object.entries(tracks as Record<string, unknown>)) {
      if (typeof raw !== "object" || raw === null) continue;
      const t = raw as Record<string, unknown>;
      const bestRaceTicks: Record<string, number> = {};
      if (typeof t.bestRaceTicks === "object" && t.bestRaceTicks !== null) {
        for (const [laps, ticks] of Object.entries(t.bestRaceTicks as Record<string, unknown>)) {
          if (isTicks(ticks)) bestRaceTicks[laps] = ticks;
        }
      }
      book.tracks[trackId] = {
        bestLapTicks: isTicks(t.bestLapTicks) ? t.bestLapTicks : null,
        bestRaceTicks,
        racesFinished: isCount(t.racesFinished) ? t.racesFinished : 0,
        wins: isCount(t.wins) ? t.wins : 0,
      };
    }
  }

  if (Array.isArray(recent)) {
    for (const raw of recent.slice(0, MAX_RECENT)) {
      if (typeof raw !== "object" || raw === null) continue;
      const r = raw as Record<string, unknown>;
      if (typeof r.trackId !== "string" || !isCount(r.laps) || (r.mode !== "solo" && r.mode !== "multiplayer")) continue;
      book.recent.push({
        trackId: r.trackId,
        laps: r.laps,
        mode: r.mode,
        totalTicks: isTicks(r.totalTicks) ? r.totalTicks : null,
        bestLapTicks: isTicks(r.bestLapTicks) ? r.bestLapTicks : null,
        position: isCount(r.position) ? r.position : null,
        racers: isCount(r.racers) ? r.racers : 1,
        at: isCount(r.at) ? r.at : 0,
      });
    }
  }
  return book;
}
