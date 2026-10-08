import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { TrackDefinition } from "@/game/entities/Track";
import { findTrack, TRACKS } from "@/game/tracks";
import { formatTicks } from "@/hud/format";
import { MENU_COLORS } from "@/menu/MenuTheme";
import { SettingRow, Stepper } from "@/menu/SettingControls";
import { TrackCard } from "@/menu/TrackCard";
import { useScores } from "@/scores/ScoresContext";
import { LAP_LIMITS, useGameSettings } from "@/settings/GameSettings";

export function RaceTab() {
  const { settings, updateSettings } = useGameSettings();
  const { scores } = useScores();
  // Picking a map also resets laps to that map's default; the player can change it after.
  const selectTrack = (track: TrackDefinition) => updateSettings({ trackId: track.id, laps: track.laps });

  const selected = scores.tracks[settings.trackId];
  const bestRace = selected?.bestRaceTicks[String(settings.laps)] ?? null;

  return (
    <View style={styles.root}>
      <Text style={styles.label}>SELECT MAP</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tracks}>
        {TRACKS.map((track) => (
          <TrackCard
            key={track.id}
            definition={track}
            selected={track.id === settings.trackId}
            onSelect={selectTrack}
            bestLapTicks={scores.tracks[track.id]?.bestLapTicks ?? null}
          />
        ))}
      </ScrollView>
      <View style={styles.bottomRow}>
        <View style={styles.box}>
          <SettingRow label="LAPS">
            <Stepper value={settings.laps} min={LAP_LIMITS.min} max={LAP_LIMITS.max} onChange={(laps) => updateSettings({ laps })} />
          </SettingRow>
        </View>
        <View style={styles.box}>
          <Text style={styles.label}>
            YOUR RECORD · {findTrack(settings.trackId).name.toUpperCase()} · {settings.laps}{" "}
            {settings.laps === 1 ? "LAP" : "LAPS"}
          </Text>
          <Text style={styles.record}>{bestRace !== null ? formatTicks(bestRace) : "Not set yet"}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", gap: 10 },
  label: { color: MENU_COLORS.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  tracks: { gap: 12, paddingVertical: 6, paddingRight: 12 },
  bottomRow: { flexDirection: "row", gap: 12, alignItems: "stretch" },
  box: { padding: 12, gap: 6, borderRadius: 12, backgroundColor: MENU_COLORS.panel, justifyContent: "center" },
  record: { color: MENU_COLORS.highlight, fontSize: 22, fontWeight: "900", fontVariant: ["tabular-nums"] },
});
