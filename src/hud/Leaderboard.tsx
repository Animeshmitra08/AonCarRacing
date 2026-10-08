import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import type { CarId } from "@/game/entities/Car";

import { formatGapTicks, formatLapTicks, formatTicks } from "./format";
import { ordinal, type Standing } from "./standings";

const MEDAL_COLORS = ["#ffd166", "#d9dde3", "#d08c4f"] as const;
const ROW_STAGGER_MS = 70;
const MAX_LIST_HEIGHT = 230;
const DOT = 12;

export interface RacerInfo {
  name: string;
  color: string;
}

interface LeaderboardProps {
  standings: readonly Standing[];
  racers: ReadonlyMap<CarId, RacerInfo>;
  localCarId: CarId;
  laps: number;
  /** False while others are still racing (rows update live). */
  final: boolean;
  /** Buttons / status under the table. */
  footer: ReactNode;
}

/** Results table: everyone's finishing position, total time, gap, best lap and every lap time. */
export function Leaderboard({ standings, racers, localCarId, laps, final, footer }: LeaderboardProps) {
  return (
    <Animated.View entering={FadeInDown.duration(260)} style={styles.panel}>
      <View style={styles.titleRow}>
        <MaterialCommunityIcons name="flag-checkered" size={22} color="white" />
        <Text style={styles.title}>{final ? "RACE RESULTS" : "RESULTS SO FAR"}</Text>
      </View>

      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.header, styles.colPos]}>POS</Text>
        <Text style={[styles.header, styles.colName]}>DRIVER</Text>
        <Text style={[styles.header, styles.colTime]}>TIME</Text>
        <Text style={[styles.header, styles.colGap]}>GAP</Text>
        <Text style={[styles.header, styles.colTime]}>BEST LAP</Text>
        <Text style={[styles.header, styles.colLaps]}>LAP TIMES</Text>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {standings.map((standing, index) => (
          <Row
            key={standing.carId}
            standing={standing}
            racer={racers.get(standing.carId)}
            isLocal={standing.carId === localCarId}
            laps={laps}
            final={final}
            delay={index * ROW_STAGGER_MS}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>{footer}</View>
    </Animated.View>
  );
}

interface RowProps {
  standing: Standing;
  racer: RacerInfo | undefined;
  isLocal: boolean;
  laps: number;
  final: boolean;
  delay: number;
}

function Row({ standing, racer, isLocal, laps, final, delay }: RowProps) {
  const medal = standing.finished ? MEDAL_COLORS[standing.position - 1] : undefined;
  const status = standing.finished ? null : final ? "DNF" : `LAP ${Math.min(standing.completedLaps + 1, laps)}/${laps}`;

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(240)} style={[styles.row, isLocal && styles.localRow]}>
      <View style={[styles.colPos, styles.posCell]}>
        {medal ? <MaterialCommunityIcons name="trophy" size={16} color={medal} /> : null}
        <Text style={[styles.pos, medal ? { color: medal } : null]}>{standing.finished ? ordinal(standing.position) : "–"}</Text>
      </View>
      <View style={[styles.colName, styles.nameCell]}>
        <View style={[styles.dot, { backgroundColor: racer?.color ?? "white" }]} />
        <Text style={styles.name} numberOfLines={1}>
          {racer?.name ?? "Racer"}
        </Text>
        {isLocal && <Text style={styles.you}>YOU</Text>}
      </View>
      <Text style={[styles.cell, styles.colTime, styles.strong]}>{status ?? formatTicks(standing.totalTicks)}</Text>
      <Text style={[styles.cell, styles.colGap]}>{standing.gapTicks !== null ? formatGapTicks(standing.gapTicks) : ""}</Text>
      <Text style={[styles.cell, styles.colTime]}>{formatTicks(standing.bestLapTicks)}</Text>
      <Text style={[styles.cell, styles.colLaps, styles.splits]} numberOfLines={1}>
        {standing.lapTimes.length > 0 ? standing.lapTimes.map(formatLapTicks).join("  ·  ") : "—"}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: "86%",
    maxWidth: 760,
    padding: 16,
    gap: 6,
    borderRadius: 18,
    backgroundColor: "rgba(10,12,22,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  title: { color: "white", fontSize: 22, fontWeight: "900", fontStyle: "italic", letterSpacing: 1.5 },
  list: { maxHeight: MAX_LIST_HEIGHT },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8 },
  headerRow: { paddingVertical: 2 },
  localRow: { backgroundColor: "rgba(255,190,11,0.16)" },
  header: { color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  colPos: { width: 64 },
  colName: { flex: 1.4 },
  colTime: { width: 86 },
  colGap: { width: 70 },
  colLaps: { flex: 1.6 },
  posCell: { flexDirection: "row", alignItems: "center", gap: 4 },
  pos: { color: "white", fontSize: 15, fontWeight: "900" },
  nameCell: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 8 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  name: { color: "white", fontSize: 15, fontWeight: "800", flexShrink: 1 },
  you: { color: "#ffbe0b", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  cell: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] },
  strong: { color: "white", fontWeight: "900" },
  splits: { color: "rgba(255,255,255,0.65)", fontSize: 12 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 6 },
});
