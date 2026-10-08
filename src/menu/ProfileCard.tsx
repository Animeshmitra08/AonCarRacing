import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAccount } from "@/account/AccountContext";
import { readIdToken } from "@/account/googleAuth";
import { displayName } from "@/account/profile";
import { MENU_COLORS } from "@/menu/MenuTheme";
import { PlayerAvatar } from "@/menu/PlayerAvatar";
import { RaceStatsTile } from "@/menu/RaceStatsTile";
import { MAX_NAME_LENGTH } from "@/network/constants";
import { useScores } from "@/scores/ScoresContext";

const AVATAR_SIZE = 76;
const BADGE_SIZE = 24;
const GOOGLE_BLUE = "#4285F4";
const VERIFIED_GREEN = "#3ddc84";

/** The player's identity: Google photo, name, email and account ID, or a guest badge. */
export function ProfileCard() {
  const { profile, google, rename, signOut } = useAccount();
  const { scores } = useScores();
  const user = profile?.google;
  const name = displayName(profile);

  const confirmSignOut = () =>
    Alert.alert("Sign out?", "Your settings and scores stay on this phone for next time.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => signOut() },
    ]);

  const confirmDisconnect = () =>
    Alert.alert(
      "Disconnect Google?",
      "Signs you out and removes Car Racing's access to your Google account. Your scores stay on this phone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", style: "destructive", onPress: () => signOut({ revokeGoogle: true }) },
      ],
    );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar photo={user?.photo ?? null} name={user?.name ?? name} isGoogle={!!user} />
        <View style={styles.identity}>
          <Text style={styles.fullName} numberOfLines={1}>
            {user?.name ?? name}
          </Text>
          {user ? (
            <View style={styles.inline}>
              <Text style={styles.email} numberOfLines={1}>
                {user.email}
              </Text>
              {readIdToken(google?.data.idToken ?? null)?.emailVerified && (
                <Ionicons name="checkmark-circle" size={14} color={VERIFIED_GREEN} />
              )}
            </View>
          ) : (
            <Text style={styles.email}>Guest · progress is saved on this phone only</Text>
          )}
          <View style={styles.providerChip}>
            <Ionicons name={user ? "logo-google" : "person"} size={11} color={user ? GOOGLE_BLUE : MENU_COLORS.textMuted} />
            <Text style={styles.providerText}>{user ? "GOOGLE ACCOUNT" : "GUEST"}</Text>
          </View>
        </View>
        <View style={styles.stats}>
          <Stat icon="flag" value={String(scores.modes.solo.played + scores.modes.multiplayer.played)} label="RACES" />
          <Stat icon="calendar" value={formatDate(profile?.createdAt)} label="SINCE" />
        </View>
      </View>

      <View style={styles.body}>
        <RaceStatsTile mode="solo" />
        <RaceStatsTile mode="multiplayer" />
      </View>

      <View style={styles.body}>
        <View style={styles.tile}>
          <Text style={styles.tileTitle}>PLAYER NAME</Text>
          <TextInput
            value={profile?.name ?? ""}
            onChangeText={rename}
            maxLength={MAX_NAME_LENGTH}
            placeholder="Your name"
            placeholderTextColor={MENU_COLORS.textMuted}
            style={styles.input}
          />
          <Text style={styles.hint}>Shown to other racers{user ? `. Your Google name is ${user.name ?? user.email}.` : "."}</Text>
        </View>
        {user && (
          <View style={styles.tile}>
            <Text style={styles.tileTitle}>ACCOUNT ID</Text>
            <Text style={[styles.accountId, styles.mono]} numberOfLines={1} selectable>
              {user.id}
            </Text>
            <Text style={styles.hint}>Your Google account&apos;s unique ID.</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <ActionButton icon="log-out-outline" label="SIGN OUT" onPress={confirmSignOut} />
        {user && <ActionButton icon="unlink" label="DISCONNECT GOOGLE" onPress={confirmDisconnect} danger />}
      </View>
    </View>
  );
}

function Avatar({ photo, name, isGoogle }: { photo: string | null; name: string; isGoogle: boolean }) {
  return (
    <View>
      <View style={styles.avatarRing}>
        <PlayerAvatar photo={photo} name={name} size={AVATAR_SIZE} />
      </View>
      {isGoogle && (
        <View style={styles.badge}>
          <Ionicons name="logo-google" size={13} color={GOOGLE_BLUE} />
        </View>
      )}
    </View>
  );
}

type IconName = ComponentProps<typeof Ionicons>["name"];

function Stat({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={14} color={MENU_COLORS.highlight} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

interface ActionButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

function ActionButton({ icon, label, onPress, danger = false }: ActionButtonProps) {
  const color = danger ? MENU_COLORS.error : MENU_COLORS.text;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function formatDate(ms: number | undefined): string {
  return ms ? new Date(ms).toLocaleDateString([], { month: "short", year: "2-digit" }) : "—";
}

const styles = StyleSheet.create({
  card: {
    flexBasis: "100%",
    padding: 16,
    gap: 14,
    borderRadius: 16,
    backgroundColor: MENU_COLORS.panel,
    borderWidth: 1,
    borderColor: MENU_COLORS.panelRaised,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarRing: {
    padding: 3,
    borderRadius: AVATAR_SIZE / 2 + 3,
    borderWidth: 2,
    borderColor: MENU_COLORS.highlight,
  },
  badge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: MENU_COLORS.panel,
  },
  identity: { flex: 1, gap: 4 },
  fullName: { color: MENU_COLORS.text, fontSize: 22, fontWeight: "900", fontStyle: "italic", letterSpacing: 0.5 },
  email: { flexShrink: 1, color: MENU_COLORS.textMuted, fontSize: 13, fontWeight: "700" },
  providerChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: MENU_COLORS.panelRaised,
  },
  providerText: { color: MENU_COLORS.text, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  stats: { flexDirection: "row", gap: 8 },
  stat: {
    minWidth: 64,
    alignItems: "center",
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: MENU_COLORS.panelRaised,
  },
  statValue: { color: MENU_COLORS.text, fontSize: 16, fontWeight: "900" },
  statLabel: { color: MENU_COLORS.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  body: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { flexGrow: 1, flexBasis: 220, gap: 8, padding: 12, borderRadius: 12, backgroundColor: MENU_COLORS.background },
  tileTitle: { color: MENU_COLORS.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  input: {
    color: MENU_COLORS.text,
    backgroundColor: MENU_COLORS.panelRaised,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: "800",
  },
  hint: { color: MENU_COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  accountId: {
    color: MENU_COLORS.text,
    backgroundColor: MENU_COLORS.panelRaised,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: "700",
  },
  mono: { fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }) },
  actions: { flexDirection: "row", gap: 10 },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: MENU_COLORS.panelRaised,
  },
  actionText: { fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  pressed: { opacity: 0.7 },
});
