import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { TrackDefinition } from "@/game/entities/Track";
import { TRACKS } from "@/game/tracks";
import { MENU_COLORS } from "@/menu/MenuTheme";
import { ColorSwatches, Segmented, SettingRow, Stepper } from "@/menu/SettingControls";
import { TrackCard } from "@/menu/TrackCard";
import { CAR_COLORS, type GraphicsQuality } from "@/rendering/RenderConstants";
import type { CameraMode } from "@/rendering/three/SceneConstants";
import { LAP_LIMITS, useGameSettings } from "@/settings/GameSettings";

const CAMERA_OPTIONS: readonly { value: CameraMode; label: string }[] = [
  { value: "close", label: "CLOSE" },
  { value: "far", label: "FAR" },
];

const GRAPHICS_OPTIONS: readonly { value: GraphicsQuality; label: string }[] = [
  { value: "performance", label: "LOW" },
  { value: "balanced", label: "MEDIUM" },
  { value: "quality", label: "HIGH" },
];

const SCREEN_PADDING = 16;

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useGameSettings();

  // Picking a map also resets laps to that map's default; the player can change it after.
  const selectTrack = (track: TrackDefinition) => updateSettings({ trackId: track.id, laps: track.laps });
  const startRace = () => router.push("/race");

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + SCREEN_PADDING,
          paddingBottom: insets.bottom + SCREEN_PADDING,
          paddingLeft: insets.left + SCREEN_PADDING,
          paddingRight: insets.right + SCREEN_PADDING,
        },
      ]}
    >
      <View style={styles.left}>
        <Text style={styles.title}>
          CAR <Text style={styles.titleAccent}>RACING</Text>
        </Text>
        <Text style={styles.sectionLabel}>SELECT MAP</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tracks}>
          {TRACKS.map((track) => (
            <TrackCard key={track.id} definition={track} selected={track.id === settings.trackId} onSelect={selectTrack} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.panel}>
        <ScrollView contentContainerStyle={styles.settings} showsVerticalScrollIndicator={false}>
          <SettingRow label="LAPS">
            <Stepper value={settings.laps} min={LAP_LIMITS.min} max={LAP_LIMITS.max} onChange={(laps) => updateSettings({ laps })} />
          </SettingRow>
          <SettingRow label="CAR COLOR">
            <ColorSwatches
              colors={CAR_COLORS}
              selectedIndex={settings.carColorIndex}
              onChange={(carColorIndex) => updateSettings({ carColorIndex })}
            />
          </SettingRow>
          <SettingRow label="CAMERA">
            <Segmented options={CAMERA_OPTIONS} value={settings.cameraMode} onChange={(cameraMode) => updateSettings({ cameraMode })} />
          </SettingRow>
          <SettingRow label="GRAPHICS">
            <Segmented
              options={GRAPHICS_OPTIONS}
              value={settings.graphicsQuality}
              onChange={(graphicsQuality) => updateSettings({ graphicsQuality })}
            />
          </SettingRow>
        </ScrollView>

        <Pressable onPress={startRace} style={({ pressed }) => [styles.raceButton, pressed && styles.raceButtonPressed]}>
          <Text style={styles.raceButtonText}>RACE ▶</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", gap: SCREEN_PADDING, backgroundColor: MENU_COLORS.background },
  left: { flex: 1.5, justifyContent: "center", gap: 10 },
  title: { color: MENU_COLORS.text, fontSize: 34, fontWeight: "900", fontStyle: "italic", letterSpacing: 1 },
  titleAccent: { color: MENU_COLORS.accent },
  sectionLabel: { color: MENU_COLORS.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  tracks: { gap: 12, paddingVertical: 6, paddingRight: 12 },
  panel: {
    flex: 1,
    maxWidth: 340,
    padding: 14,
    gap: 12,
    borderRadius: 16,
    backgroundColor: MENU_COLORS.panel,
  },
  settings: { gap: 14 },
  raceButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: MENU_COLORS.accent,
  },
  raceButtonPressed: { opacity: 0.75 },
  raceButtonText: { color: MENU_COLORS.text, fontSize: 20, fontWeight: "900", letterSpacing: 2 },
});
