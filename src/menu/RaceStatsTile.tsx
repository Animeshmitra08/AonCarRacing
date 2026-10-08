import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { MENU_COLORS } from "@/menu/MenuTheme";
import type { ModeStats, RaceMode } from "@/scores/scoreBook";
import { useScores } from "@/scores/ScoresContext";

type IconName = ComponentProps<typeof Ionicons>["name"];

const MODE_INFO: Record<RaceMode, { title: string; icon: IconName; name: string }> = {
  solo: { title: "NORMAL RACES", icon: "speedometer", name: "normal race" },
  multiplayer: { title: "MULTIPLAYER RACES", icon: "people", name: "multiplayer" },
};

/** One race mode's career counts, with a reset. */
export function RaceStatsTile({ mode }: { mode: RaceMode }) {
  const { scores, resetMode } = useScores();
  const stats = scores.modes[mode];
  const info = MODE_INFO[mode];

  const confirmReset = () =>
    Alert.alert(`Reset ${info.name} stats?`, "Sets these counts back to zero. Your best times are kept.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: () => resetMode(mode) },
    ]);

  return (
    <View style={styles.tile}>
      <View style={styles.header}>
        <Ionicons name={info.icon} size={14} color={MENU_COLORS.highlight} />
        <Text style={styles.title}>{info.title}</Text>
        <Pressable
          onPress={confirmReset}
          disabled={stats.played === 0}
          hitSlop={8}
          style={({ pressed }) => [styles.reset, stats.played === 0 && styles.disabled, pressed && styles.pressed]}
        >
          <Ionicons name="refresh" size={12} color={MENU_COLORS.textMuted} />
          <Text style={styles.resetText}>RESET</Text>
        </Pressable>
      </View>
      <View style={styles.values}>
        {statsFor(mode, stats).map(({ label, value }) => (
          <View key={label} style={styles.value}>
            <Text style={styles.number}>{value}</Text>
            <Text style={styles.label}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function statsFor(mode: RaceMode, stats: ModeStats): { label: string; value: string }[] {
  if (mode === "solo") {
    return [
      { label: "PLAYED", value: String(stats.played) },
      { label: "FINISHED", value: String(stats.finished) },
      { label: "FINISH RATE", value: percent(stats.finished, stats.played) },
    ];
  }
  return [
    { label: "PLAYED", value: String(stats.played) },
    { label: "WINS", value: String(stats.wins) },
    { label: "PODIUMS", value: String(stats.podiums) },
    { label: "WIN RATE", value: percent(stats.wins, stats.played) },
  ];
}

function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

const styles = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: 220, gap: 10, padding: 12, borderRadius: 12, backgroundColor: MENU_COLORS.background },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { flex: 1, color: MENU_COLORS.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  reset: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: MENU_COLORS.panelRaised,
  },
  resetText: { color: MENU_COLORS.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  values: { flexDirection: "row", gap: 8 },
  value: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: MENU_COLORS.panelRaised,
  },
  number: { color: MENU_COLORS.text, fontSize: 18, fontWeight: "900" },
  label: { color: MENU_COLORS.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
