import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { SNAP_WRONG_WAY } from "@/rendering/RenderSnapshot";

const FLASH_MS = 320;
const FADE_MS = 150;

/** Flashing "WRONG WAY" banner, shown/hidden entirely on the UI thread from the frame snapshot. */
export function WrongWayIndicator({ snapshot, top }: { snapshot: SharedValue<number[]>; top: number }) {
  const opacity = useSharedValue(0);

  useAnimatedReaction(
    () => snapshot.get()[SNAP_WRONG_WAY] > 0.5,
    (wrongWay, previous) => {
      if (wrongWay === previous) return;
      cancelAnimation(opacity);
      opacity.set(
        wrongWay
          ? withRepeat(withSequence(withTiming(1, { duration: FLASH_MS }), withTiming(0.45, { duration: FLASH_MS })), -1)
          : withTiming(0, { duration: FADE_MS }),
      );
    },
  );

  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: 0.9 + opacity.get() * 0.1 }],
  }));

  return (
    <Animated.View style={[styles.banner, { top }, style]}>
      <MaterialCommunityIcons name="arrow-u-left-top" size={34} color="white" />
      <Text style={styles.text}>WRONG WAY</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: "white",
    backgroundColor: "rgba(214,40,40,0.92)",
    pointerEvents: "none",
  },
  text: { color: "white", fontSize: 30, fontWeight: "900", fontStyle: "italic", letterSpacing: 2 },
});
