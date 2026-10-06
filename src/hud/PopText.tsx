import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";

const POP_IN_MS = 160;
const POP_OUT_MS = 260;
const START_SCALE = 1.8;

interface PopTextProps {
  text: string;
  /** How long to stay visible; omit to stay until unmounted. */
  holdMs?: number;
  color?: string;
}

/** Big centred text that pops in (and optionally fades out). Remount via `key` to replay. */
export function PopText({ text, holdMs, color = "white" }: PopTextProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const popIn = withTiming(1, { duration: POP_IN_MS });
    progress.set(holdMs === undefined ? popIn : withSequence(popIn, withDelay(holdMs, withTiming(2, { duration: POP_OUT_MS }))));
  }, [progress, holdMs]);

  // 0→1: scale down into place and fade in. 1→2: fade out.
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    const appear = Math.min(p, 1);
    return {
      opacity: p <= 1 ? appear : 2 - p,
      transform: [{ scale: START_SCALE - (START_SCALE - 1) * appear }],
    };
  });

  return <Animated.Text style={[styles.text, { color }, style]}>{text}</Animated.Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: 96,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
});
