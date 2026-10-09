import { Ionicons } from "@expo/vector-icons";
import { router, useIsFocused } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
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
const RACE_BUTTON_FADE_MS = 150;

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { profile } = useAccount();
  const [tab, setTab] = useState<HomeTab>("race");
  const google = profile?.google;
  const chipName = google?.name ?? displayName(profile);

  const sidePadding = { paddingLeft: insets.left + SCREEN_PADDING, paddingRight: insets.right + SCREEN_PADDING };

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, sidePadding, { paddingTop: insets.top + SCREEN_PADDING / 2 }]}>
        <Text style={styles.title}>
          CAR <Text style={styles.titleAccent}>RACING</Text>
        </Text>
        <View style={styles.actions}>
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
          {/* Multiplayer has its own HOST/JOIN buttons; everywhere else this starts a solo race. */}
          {tab !== "multiplayer" && (
            <Animated.View entering={FadeIn.duration(RACE_BUTTON_FADE_MS)} exiting={FadeOut.duration(RACE_BUTTON_FADE_MS)}>
              <RaceButton onPress={() => router.push("/race")} />
            </Animated.View>
          )}
        </View>
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
        bottomInset={insets.bottom}
        leftInset={insets.left}
        rightInset={insets.right}
      />
    </View>
  );
}

/** The slanted call-to-action that starts a solo race. */
function RaceButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Start race"
      style={({ pressed }) => [styles.raceButton, pressed && styles.raceButtonPressed]}
    >
      <View style={styles.raceButtonContent}>
        <Text style={styles.raceButtonText}>RACE</Text>
        <Ionicons name="play" size={18} color={MENU_COLORS.onHighlight} />
      </View>
    </Pressable>
  );
}

const RACE_BUTTON_SKEW = "-14deg";
const RACE_BUTTON_UNSKEW = "14deg";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MENU_COLORS.background },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8 },
  title: { color: MENU_COLORS.text, fontSize: 26, fontWeight: "900", fontStyle: "italic", letterSpacing: 1 },
  titleAccent: { color: MENU_COLORS.accent },
  actions: { flexDirection: "row", alignItems: "center", gap: 14 },
  raceButton: {
    height: 40,
    paddingHorizontal: 26,
    justifyContent: "center",
    backgroundColor: MENU_COLORS.highlight,
    transform: [{ skewX: RACE_BUTTON_SKEW }],
  },
  raceButtonPressed: { opacity: 0.85 },
  raceButtonContent: { flexDirection: "row", alignItems: "center", gap: 6, transform: [{ skewX: RACE_BUTTON_UNSKEW }] },
  raceButtonText: { color: MENU_COLORS.onHighlight, fontSize: 18, fontWeight: "900", fontStyle: "italic", letterSpacing: 2 },
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
