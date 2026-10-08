import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { FadeInUp, FadeOut } from "react-native-reanimated";

import { ordinal } from "./standings";

const VISIBLE_MS = 3200;

/** "Ann finished 1st" — shown to players still racing when someone else crosses the line. Remount via `key`. */
export function FinisherToast({ name, position, top }: { name: string; position: number; top: number }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;

  return (
    <Animated.View entering={FadeInUp.duration(220)} exiting={FadeOut.duration(250)} style={[styles.toast, { top }]}>
      <MaterialCommunityIcons name="flag-checkered" size={18} color="white" />
      <Text style={styles.text}>
        {name.toUpperCase()} FINISHED {ordinal(position)}
        {position === 1 ? " · KEEP PUSHING!" : ""}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.6)",
    pointerEvents: "none",
  },
  text: { color: "white", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
});
