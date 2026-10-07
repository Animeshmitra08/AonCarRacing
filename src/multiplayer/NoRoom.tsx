import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { MENU_COLORS } from "@/menu/MenuTheme";

/** Shown if a room screen is opened without an active session (e.g. after a reload). */
export function NoRoom() {
  return (
    <View style={styles.root}>
      <Text style={styles.text}>You are not in a room.</Text>
      <Pressable onPress={() => router.replace("/multiplayer")} style={styles.button}>
        <Text style={styles.text}>MULTIPLAYER MENU</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: MENU_COLORS.background },
  text: { color: MENU_COLORS.text, fontSize: 16, fontWeight: "800" },
  button: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: MENU_COLORS.accent },
});
