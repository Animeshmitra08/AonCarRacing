import { Ionicons } from "@expo/vector-icons";
import { router, useIsFocused } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomNavBar, type NavTab } from "@/menu/BottomNavBar";
import { MENU_COLORS } from "@/menu/MenuTheme";
import { PlayerAvatar } from "@/menu/PlayerAvatar";
import { GarageTab } from "@/menu/tabs/GarageTab";
import { MultiplayerPanel } from "@/menu/tabs/MultiplayerPanel";
import { RaceTab } from "@/menu/tabs/RaceTab";
import { SettingsTab } from "@/menu/tabs/SettingsTab";
import { useAccount } from "@/account/AccountContext";
import { displayName } from "@/account/profile";

type HomeTab = "race" | "garage" | "multiplayer" | "settings";

const TABS: readonly NavTab<HomeTab>[] = [
  { key: "race", label: "RACE", icon: "flag" },
  { key: "garage", label: "GARAGE", icon: "car-sport" },
  { key: "multiplayer", label: "MULTIPLAYER", icon: "people" },
  { key: "settings", label: "SETTINGS", icon: "settings-sharp" },
];

const SCREEN_PADDING = 16;
const AVATAR_SIZE = 22;
const TAB_FADE_MS = 180;

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { profile } = useAccount();
  const [tab, setTab] = useState<HomeTab>("race");
  const google = profile?.google;
  const chipName = google?.name ?? displayName(profile);

  // Multiplayer has its own HOST/JOIN buttons; everywhere else the big button starts a solo race.
  const primary = tab === "multiplayer" ? null : { label: "RACE", onPress: () => router.push("/race") };
  const sidePadding = { paddingLeft: insets.left + SCREEN_PADDING, paddingRight: insets.right + SCREEN_PADDING };

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, sidePadding, { paddingTop: insets.top + SCREEN_PADDING / 2 }]}>
        <Text style={styles.title}>
          CAR <Text style={styles.titleAccent}>RACING</Text>
        </Text>
        <Pressable onPress={() => setTab("settings")} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
          {google ? (
            <PlayerAvatar photo={google.photo} name={chipName} size={AVATAR_SIZE} />
          ) : (
            <Ionicons name="person-circle" size={AVATAR_SIZE} color={MENU_COLORS.highlight} />
          )}
          <Text style={styles.chipText} numberOfLines={1}>
            {chipName}
          </Text>
        </Pressable>
      </View>

      <Animated.View key={tab} entering={FadeIn.duration(TAB_FADE_MS)} style={[styles.content, sidePadding]}>
        {tab === "race" && <RaceTab />}
        {tab === "garage" && <GarageTab visible={isFocused} />}
        {tab === "multiplayer" && <MultiplayerPanel />}
        {tab === "settings" && <SettingsTab />}
      </Animated.View>

      <BottomNavBar
        tabs={TABS}
        active={tab}
        onChange={setTab}
        primary={primary}
        bottomInset={insets.bottom}
        sideInset={insets.left}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MENU_COLORS.background },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8 },
  title: { color: MENU_COLORS.text, fontSize: 26, fontWeight: "900", fontStyle: "italic", letterSpacing: 1 },
  titleAccent: { color: MENU_COLORS.accent },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 200,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: MENU_COLORS.panel,
  },
  chipText: { color: MENU_COLORS.text, fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.7 },
  content: { flex: 1, paddingBottom: 12 },
});
