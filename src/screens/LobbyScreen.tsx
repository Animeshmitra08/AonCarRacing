import { router } from "expo-router";
import { useEffect } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { findTrack } from "@/game/tracks";
import { MENU_COLORS } from "@/menu/MenuTheme";
import { useLobby, useMultiplayer, type Session } from "@/multiplayer/MultiplayerContext";
import { NoRoom } from "@/multiplayer/NoRoom";
import { useHardwareBack } from "@/multiplayer/useHardwareBack";
import { formatRoomCode } from "@/network/roomCode";
import { CAR_COLORS } from "@/rendering/RenderConstants";

const SCREEN_PADDING = 16;
const DOT_SIZE = 14;
const ADDRESS_REFRESH_MS = 3000;

export function LobbyScreen() {
  const { session } = useMultiplayer();
  return session ? <Lobby session={session} /> : <NoRoom />;
}

function Lobby({ session }: { session: Session }) {
  const insets = useSafeAreaInsets();
  const { setSession } = useMultiplayer();
  const lobby = useLobby(session);
  const isHost = session.role === "host";
  const track = lobby.trackId ? findTrack(lobby.trackId) : null;
  const { status, closeReason } = lobby;

  useEffect(() => {
    if (status === "racing") {
      router.replace("/multiplayer/race");
    } else if (status === "closed" && session.role === "client") {
      Alert.alert("Room closed", closeReason ?? "The room was closed.");
      router.back();
    }
  }, [status, closeReason, session]);

  // Pick up a hotspot/Wi-Fi switched on (or off) after the room was created.
  useEffect(() => {
    if (session.role !== "host" || status !== "lobby") return;
    const timer = setInterval(() => session.refreshAddresses(), ADDRESS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [session, status]);

  const leave = () => {
    router.back();
    setSession(null);
  };
  useHardwareBack(leave);

  const startRace = () => {
    if (session.role === "host") session.startRace();
  };

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
      <View style={styles.side}>
        <Text style={styles.label}>ROOM CODE</Text>
        {lobby.roomCode ? (
          <Text style={styles.code} adjustsFontSizeToFit numberOfLines={1}>
            {formatRoomCode(lobby.roomCode)}
          </Text>
        ) : isHost ? (
          <Text style={styles.warning}>Turn on Wi-Fi or your hotspot. The code appears here automatically.</Text>
        ) : (
          <Text style={styles.code}>…</Text>
        )}
        {isHost && lobby.roomCode && (
          <Text style={styles.hint}>
            Players on your Wi-Fi or hotspot enter this code to join.
            {"\n"}Or they can type this phone&apos;s IP: {lobby.hostAddresses.join(" / ")}
          </Text>
        )}
        {track && (
          <View style={styles.trackInfo}>
            <Text style={styles.label}>MAP</Text>
            <Text style={styles.value}>
              {track.name} · {lobby.laps} {lobby.laps === 1 ? "lap" : "laps"}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.label}>PLAYERS ({lobby.players.length})</Text>
        <ScrollView contentContainerStyle={styles.players}>
          {lobby.players.map((player) => (
            <View key={player.id} style={[styles.player, !player.connected && styles.disconnected]}>
              <View style={[styles.dot, { backgroundColor: CAR_COLORS[player.colorIndex % CAR_COLORS.length] }]} />
              <Text style={styles.playerName}>{player.name}</Text>
              {player.isHost && <Text style={styles.tag}>HOST</Text>}
              {player.id === lobby.localPlayerId && <Text style={styles.tag}>YOU</Text>}
            </View>
          ))}
        </ScrollView>

        <View style={styles.buttons}>
          <Pressable onPress={leave} style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.dim]}>
            <Text style={styles.buttonText}>LEAVE</Text>
          </Pressable>
          {isHost ? (
            <Pressable onPress={startRace} style={({ pressed }) => [styles.button, styles.primary, pressed && styles.dim]}>
              <Text style={styles.buttonText}>START RACE</Text>
            </Pressable>
          ) : (
            <Text style={styles.waiting}>Waiting for the host to start…</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", gap: SCREEN_PADDING, backgroundColor: MENU_COLORS.background },
  side: { flex: 1, justifyContent: "center", gap: 8 },
  label: { color: MENU_COLORS.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  code: { color: MENU_COLORS.text, fontSize: 48, fontWeight: "900", letterSpacing: 4 },
  hint: { color: MENU_COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  warning: { color: MENU_COLORS.highlight, fontSize: 15, fontWeight: "800" },
  trackInfo: { marginTop: 12, gap: 4 },
  value: { color: MENU_COLORS.text, fontSize: 16, fontWeight: "700" },
  panel: { flex: 1.2, padding: 16, gap: 10, borderRadius: 16, backgroundColor: MENU_COLORS.panel },
  players: { gap: 8 },
  player: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: MENU_COLORS.panelRaised,
  },
  disconnected: { opacity: 0.4 },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
  playerName: { flex: 1, color: MENU_COLORS.text, fontSize: 15, fontWeight: "800" },
  tag: { color: MENU_COLORS.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  buttons: { flexDirection: "row", alignItems: "center", gap: 12 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  primary: { backgroundColor: MENU_COLORS.accent },
  secondary: { backgroundColor: MENU_COLORS.panelRaised },
  dim: { opacity: 0.7 },
  buttonText: { color: MENU_COLORS.text, fontSize: 16, fontWeight: "900", letterSpacing: 1.2 },
  waiting: { flex: 1, color: MENU_COLORS.textMuted, fontSize: 13, fontWeight: "700", textAlign: "center" },
});
