import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAccount } from "@/account/AccountContext";
import type { SteeringControl } from "@/controls/steeringOptions";
import type { TiltSensitivity } from "@/controls/tiltSteering";
import { MENU_COLORS } from "@/menu/MenuTheme";
import { Segmented, SettingRow, Toggle } from "@/menu/SettingControls";
import { MAX_NAME_LENGTH } from "@/network/constants";
import type { GraphicsQuality } from "@/rendering/RenderConstants";
import type { CameraMode } from "@/rendering/three/SceneConstants";
import { totals } from "@/scores/scoreBook";
import { useScores } from "@/scores/ScoresContext";
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
  const { profile, rename, signOut } = useAccount();
  const { scores } = useScores();
  const stats = totals(scores);

  const confirmSignOut = () =>
    Alert.alert("Sign out?", "Your settings and scores stay on this phone for next time.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.root} showsVerticalScrollIndicator={false}>
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

      <Section title="PROFILE">
        <SettingRow label="PLAYER NAME">
          <TextInput
            value={profile?.name ?? ""}
            onChangeText={rename}
            maxLength={MAX_NAME_LENGTH}
            placeholder="Your name"
            placeholderTextColor={MENU_COLORS.textMuted}
            style={styles.input}
          />
        </SettingRow>
        <Text style={styles.hint}>
          Signed in as {profile?.provider === "google" ? "Google user" : "guest"} · {stats.racesFinished} races finished ·{" "}
          {stats.wins} multiplayer wins
        </Text>
        <Pressable onPress={confirmSignOut} style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
          <Ionicons name="log-out-outline" size={18} color={MENU_COLORS.text} />
          <Text style={styles.signOutText}>SIGN OUT</Text>
        </Pressable>
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
  input: {
    color: MENU_COLORS.text,
    backgroundColor: MENU_COLORS.panelRaised,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: "800",
  },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: MENU_COLORS.panelRaised,
  },
  signOutText: { color: MENU_COLORS.text, fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  pressed: { opacity: 0.7 },
});
