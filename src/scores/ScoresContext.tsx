import { createContext, use, useRef, useState, type ReactNode } from "react";

import { STORAGE_KEYS, writeJson } from "@/storage/secureJson";

import {
  emptyScoreBook,
  recordResult,
  resetModeStats,
  type RaceMode,
  type RaceResult,
  type RecordOutcome,
  type ScoreBook,
} from "./scoreBook";

interface ScoresContextValue {
  scores: ScoreBook;
  /** Saves a finished (or DNF) race and reports any new personal bests. */
  record: (result: RaceResult) => RecordOutcome;
  /** Zeroes one mode's race counts; personal bests are kept. */
  resetMode: (mode: RaceMode) => void;
  clear: () => void;
}

const ScoresContext = createContext<ScoresContextValue | null>(null);

/** Personal bests and recent races, persisted with expo-secure-store. */
export function ScoresProvider({ initial, children }: { initial: ScoreBook; children: ReactNode }) {
  const [scores, setScores] = useState(initial);
  // Callers may hold an old `record` (e.g. inside an engine subscription), so always
  // build on the newest book rather than the one captured at render time.
  const latest = useRef(initial);

  const commit = (book: ScoreBook) => {
    latest.current = book;
    setScores(book);
    void writeJson(STORAGE_KEYS.scores, book);
  };

  const record = (result: RaceResult): RecordOutcome => {
    const { book, outcome } = recordResult(latest.current, result);
    commit(book);
    return outcome;
  };

  const resetMode = (mode: RaceMode) => commit(resetModeStats(latest.current, mode));

  const clear = () => commit(emptyScoreBook());

  return <ScoresContext value={{ scores, record, resetMode, clear }}>{children}</ScoresContext>;
}

export function useScores(): ScoresContextValue {
  const context = use(ScoresContext);
  if (!context) throw new Error("useScores must be used inside <ScoresProvider>.");
  return context;
}
