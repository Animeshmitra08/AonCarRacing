import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { SteeringControl } from "@/controls/steeringOptions";
import type { TiltSensitivity } from "@/controls/tiltSteering";
import { MENU_COLORS } from "@/menu/MenuTheme";
import { ProfileCard } from "@/menu/ProfileCard";
import { Segmented, SettingRow, Toggle } from "@/menu/SettingControls";
import type { GraphicsQuality } from "@/rendering/RenderConstants";
import type { CameraMode } from "@/rendering/three/SceneConstants";
import { useGameSettings } from "@/settings/GameSettings";

const CAMERA_OPTIONS: readonly { value: CameraMode; label: string }[] = [
  { value: "close", label: "CLOSE" },
  { value: "far", label: "FAR" },
];

const GRAPHICS_OPTIONS: readonly { value: GraphicsQuality; label: string }[] = [
  { value: "performance", label: "LOW" },
  { value: "balanced", label: "MEDIUM" },
  { value: "quality", label: "HIGH" },
];

const STEERING_OPTIONS: readonly { value: SteeringControl; label: string }[] = [
  { value: "buttons", label: "◀ ▶ BUTTONS" },
  { value: "wheel", label: "WHEEL" },
];

const SENSITIVITY_OPTIONS: readonly { value: TiltSensitivity; label: string }[] = [
  { value: "low", label: "LOW" },
  { value: "medium", label: "MEDIUM" },
  { value: "high", label: "HIGH" },
];

export function SettingsTab() {
  const { settings, updateSettings } = useGameSettings();

  return (
    <ScrollView contentContainerStyle={styles.root} showsVerticalScrollIndicator={false}>
      <ProfileCard />

      <Section title="CONTROLS">
        <SettingRow label="ON-SCREEN STEERING">
          <Segmented
            options={STEERING_OPTIONS}
            value={settings.steeringControl}
            onChange={(steeringControl) => updateSettings({ steeringControl })}
          />
        </SettingRow>
        <Text style={styles.hint}>
          {settings.steeringControl === "wheel"
            ? settings.tiltSteering
              ? "The wheel turns with your phone. Grab it to steer by hand."
              : "Put your thumb on the wheel and turn it. It re-centres when you let go."
            : "Hold ◀ or ▶ to steer."}
        </Text>
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleTitle}>Tilt steering</Text>
            <Text style={styles.hint}>Turn the phone like a steering wheel. Works with both controls above.</Text>
          </View>
          <Toggle value={settings.tiltSteering} onChange={(tiltSteering) => updateSettings({ tiltSteering })} />
        </View>
        {settings.tiltSteering && (
          <SettingRow label="TILT SENSITIVITY">
            <Segmented
              options={SENSITIVITY_OPTIONS}
              value={settings.tiltSensitivity}
              onChange={(tiltSensitivity) => updateSettings({ tiltSensitivity })}
            />
          </SettingRow>
        )}
      </Section>

      <Section title="DISPLAY">
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
      </Section>

    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", flexWrap: "wrap", gap: 16, paddingBottom: 8 },
  section: { flexGrow: 1, flexBasis: 240, padding: 16, gap: 14, borderRadius: 16, backgroundColor: MENU_COLORS.panel },
  sectionTitle: { color: MENU_COLORS.text, fontSize: 16, fontWeight: "900", fontStyle: "italic", letterSpacing: 1 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleText: { flex: 1, gap: 2 },
  toggleTitle: { color: MENU_COLORS.text, fontSize: 15, fontWeight: "800" },
  hint: { color: MENU_COLORS.textMuted, fontSize: 12, fontWeight: "600" },
});
