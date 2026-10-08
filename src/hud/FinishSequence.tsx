import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeOut, ZoomIn } from "react-native-reanimated";

import type { RecordOutcome } from "@/scores/scoreBook";

import { Confetti } from "./Confetti";
import { formatTicks } from "./format";
import { ordinal } from "./standings";

/** How long the finish banner shows before the leaderboard replaces it. */
const BANNER_MS = 2400;
const PODIUM_COLORS = ["#ffd166", "#d9dde3", "#d08c4f"] as const;

interface FinishSequenceProps {
  position: number;
  totalTicks: number | null;
  personalBest: RecordOutcome | null;
  /** Rendered once the banner has played (the leaderboard). */
  children: ReactNode;
}

/**
 * The local player crossed the line: confetti + a big position banner, then the
 * leaderboard. Mounted once per finish, so restarting the race replays it.
 */
export function FinishSequence({ position, totalTicks, personalBest, children }: FinishSequenceProps) {
  const [stage, setStage] = useState<"banner" | "board">("banner");

  useEffect(() => {
    const timer = setTimeout(() => setStage("board"), BANNER_MS);
    return () => clearTimeout(timer);
  }, []);

  const podium = PODIUM_COLORS[position - 1];
  const headline = position === 1 ? "YOU WIN!" : "FINISHED!";

  return (
    <View style={styles.root}>
      {position <= 3 && <Confetti />}
      {stage === "banner" ? (
        <Animated.View entering={ZoomIn.springify().damping(12)} exiting={FadeOut.duration(200)} style={styles.banner}>
          <MaterialCommunityIcons name={podium ? "trophy" : "flag-checkered"} size={72} color={podium ?? "white"} />
          <Text style={[styles.place, podium ? { color: podium } : null]}>{ordinal(position)} PLACE</Text>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.time}>{formatTicks(totalTicks)}</Text>
          {personalBest && (personalBest.newBestRace || personalBest.newBestLap) && (
            <Animated.View entering={ZoomIn.delay(500).springify()} style={styles.record}>
              <MaterialCommunityIcons name="star-four-points" size={16} color="#14110a" />
              <Text style={styles.recordText}>{personalBest.newBestRace ? "NEW RECORD!" : "NEW BEST LAP!"}</Text>
            </Animated.View>
          )}
        </Animated.View>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", pointerEvents: "box-none" },
  banner: { alignItems: "center", gap: 2, pointerEvents: "none" },
  place: {
    color: "white",
    fontSize: 64,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 2,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  headline: { color: "white", fontSize: 26, fontWeight: "900", letterSpacing: 4 },
  time: { color: "rgba(255,255,255,0.85)", fontSize: 18, fontWeight: "800", marginTop: 4, fontVariant: ["tabular-nums"] },
  record: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ffd166",
  },
  recordText: { color: "#14110a", fontSize: 14, fontWeight: "900", letterSpacing: 1.5 },
});
