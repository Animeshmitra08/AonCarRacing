import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { TrackDefinition } from "@/game/entities/Track";
import { TRACKS } from "@/game/tracks";
import { MENU_COLORS } from "@/menu/MenuTheme";
import { SettingRow, Stepper } from "@/menu/SettingControls";
import { TrackCard } from "@/menu/TrackCard";
import { LAP_LIMITS, useGameSettings } from "@/settings/GameSettings";

export function RaceTab() {
  const { settings, updateSettings } = useGameSettings();
  // Picking a map also resets laps to that map's default; the player can change it after.
  const selectTrack = (track: TrackDefinition) => updateSettings({ trackId: track.id, laps: track.laps });

  return (
    <View style={styles.root}>
      <Text style={styles.label}>SELECT MAP</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tracks}>
        {TRACKS.map((track) => (
          <TrackCard key={track.id} definition={track} selected={track.id === settings.trackId} onSelect={selectTrack} />
        ))}
      </ScrollView>
      <View style={styles.laps}>
        <SettingRow label="LAPS">
          <Stepper value={settings.laps} min={LAP_LIMITS.min} max={LAP_LIMITS.max} onChange={(laps) => updateSettings({ laps })} />
        </SettingRow>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", gap: 10 },
  label: { color: MENU_COLORS.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  tracks: { gap: 12, paddingVertical: 6, paddingRight: 12 },
  laps: { alignSelf: "flex-start", padding: 12, borderRadius: 12, backgroundColor: MENU_COLORS.panel },
});
