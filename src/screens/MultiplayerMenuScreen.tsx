import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MENU_COLORS } from "@/menu/MenuTheme";
import { MultiplayerPanel } from "@/menu/tabs/MultiplayerPanel";

const SCREEN_PADDING = 16;

/** Standalone route for the host/join panel (the home screen also shows it as a tab). */
export function MultiplayerMenuScreen() {
  const insets = useSafeAreaInsets();

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
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={10}>
          <Text style={styles.back}>‹ BACK</Text>
        </Pressable>
        <Text style={styles.title}>MULTIPLAYER</Text>
      </View>
      <MultiplayerPanel />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 12, backgroundColor: MENU_COLORS.background },
  header: { flexDirection: "row", alignItems: "center", gap: 16 },
  back: { color: MENU_COLORS.textMuted, fontSize: 14, fontWeight: "800" },
  title: { color: MENU_COLORS.text, fontSize: 28, fontWeight: "900", fontStyle: "italic" },
});
