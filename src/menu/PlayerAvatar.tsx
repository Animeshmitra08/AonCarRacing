import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { MENU_COLORS } from "@/menu/MenuTheme";

/** The player's Google photo, or their initials when there isn't one. */
export function PlayerAvatar({ photo, name, size }: { photo: string | null; name: string; size: number }) {
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (photo) {
    return <Image source={{ uri: photo }} style={shape} contentFit="cover" transition={200} cachePolicy="disk" />;
  }
  return (
    <View style={[shape, styles.fallback]}>
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials(name)}</Text>
    </View>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center", backgroundColor: MENU_COLORS.accent },
  initials: { color: MENU_COLORS.text, fontWeight: "900", fontStyle: "italic" },
});
