import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAccount } from "@/account/AccountContext";
import { displayName } from "@/account/profile";
import { findTrack } from "@/game/tracks";
import { MENU_COLORS } from "@/menu/MenuTheme";
import { SettingRow } from "@/menu/SettingControls";
import { useMultiplayer } from "@/multiplayer/MultiplayerContext";
import { hostRoom, joinRoom } from "@/multiplayer/sessionFactory";
import { MAX_NAME_LENGTH } from "@/network/constants";
import { useGameSettings } from "@/settings/GameSettings";

/** Long enough for a full IPv4 address typed instead of a code. */
const MAX_CODE_INPUT = 15;

type Busy = "host" | "join" | null;

/** Host-a-room / join-a-room panels. Used by the home MULTIPLAYER tab and the /multiplayer screen. */
export function MultiplayerPanel() {
  const { settings } = useGameSettings();
  const { profile, rename } = useAccount();
  const { setSession } = useMultiplayer();
  const name = displayName(profile);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const track = findTrack(settings.trackId);

  const run = async (kind: Exclude<Busy, null>) => {
    setBusy(kind);
    setError(null);
    try {
      setSession(kind === "host" ? await hostRoom(settings, name) : await joinRoom(code, settings, name));
      router.push("/multiplayer/lobby");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.nameRow}>
        <Text style={styles.label}>PLAYING AS</Text>
        <TextInput
          value={profile?.name ?? ""}
          onChangeText={rename}
          maxLength={MAX_NAME_LENGTH}
          placeholder="Your name"
          placeholderTextColor={MENU_COLORS.textMuted}
          style={[styles.input, styles.nameInput]}
        />
      </View>

      <View style={styles.columns}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>HOST A ROOM</Text>
          <SettingRow label="MAP">
            <Text style={styles.value}>
              {track.name} · {settings.laps} {settings.laps === 1 ? "lap" : "laps"}
            </Text>
          </SettingRow>
          <Text style={styles.hint}>Pick the map and laps in the RACE tab.</Text>
          <ActionButton label="HOST ROOM" loading={busy === "host"} disabled={busy !== null} onPress={() => run("host")} />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>JOIN A ROOM</Text>
          <SettingRow label="ROOM CODE">
            <TextInput
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={MAX_CODE_INPUT}
              placeholder="e.g. 30A-GFNN"
              placeholderTextColor={MENU_COLORS.textMuted}
              style={[styles.input, styles.codeInput]}
            />
          </SettingRow>
          <ActionButton
            label="JOIN"
            loading={busy === "join"}
            disabled={busy !== null || code.trim().length === 0}
            onPress={() => run("join")}
          />
        </View>
      </View>

      <Text style={error ? styles.error : styles.hint}>
        {error ?? "All phones must be on the same Wi-Fi, or connected to the host phone's hotspot."}
      </Text>
    </View>
  );
}

interface ActionButtonProps {
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}

function ActionButton({ label, loading, disabled, onPress }: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.buttonDim]}
    >
      {loading ? <ActivityIndicator color={MENU_COLORS.text} /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: { color: MENU_COLORS.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  columns: { flex: 1, flexDirection: "row", gap: 16 },
  panel: { flex: 1, padding: 16, gap: 12, borderRadius: 16, backgroundColor: MENU_COLORS.panel, justifyContent: "center" },
  panelTitle: { color: MENU_COLORS.text, fontSize: 18, fontWeight: "900" },
  value: { color: MENU_COLORS.text, fontSize: 16, fontWeight: "700" },
  input: {
    color: MENU_COLORS.text,
    backgroundColor: MENU_COLORS.panelRaised,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontWeight: "800",
  },
  nameInput: { minWidth: 160, fontSize: 15 },
  codeInput: { fontSize: 24, letterSpacing: 4, textAlign: "center" },
  hint: { color: MENU_COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  error: { color: MENU_COLORS.error, fontSize: 13, fontWeight: "800" },
  button: { paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: MENU_COLORS.accent },
  buttonDim: { opacity: 0.6 },
  buttonText: { color: MENU_COLORS.text, fontSize: 17, fontWeight: "900", letterSpacing: 1.5 },
});
