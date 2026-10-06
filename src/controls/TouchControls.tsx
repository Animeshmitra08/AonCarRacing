import { useMemo, useRef } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { createNeutralInput, type CarInput } from "@/game/state/CarInput";

type ControlButton = "left" | "right" | "throttle" | "brake" | "boost";
type ButtonState = Record<ControlButton, boolean>;

const EDGE_PADDING = 20;
const BUTTON_SIZE = 84;
const THROTTLE_HEIGHT = 120;
const BOOST_SIZE = 64;
const PRESS_TIMING = { duration: 70 } as const;
/** Fingers drift while racing; never cancel a held button for moving. */
const UNLIMITED_DISTANCE = 10_000;

interface TouchControlsProps {
  /** Receives the same (mutated) object on each change; consumers should copy it. */
  onInputChange: (input: Readonly<CarInput>) => void;
}

/**
 * Turns touches into a `CarInput`. It never touches the car or engine directly,
 * so the same input shape can come from a network peer later.
 */
export function TouchControls({ onInputChange }: TouchControlsProps) {
  const insets = useSafeAreaInsets();
  const buttons = useRef<ButtonState>({ left: false, right: false, throttle: false, brake: false, boost: false });
  const input = useRef(createNeutralInput());

  const setPressed = (button: ControlButton, pressed: boolean) => {
    const b = buttons.current;
    b[button] = pressed;
    const next = input.current;
    next.steering = (b.right ? 1 : 0) - (b.left ? 1 : 0);
    next.throttle = b.throttle ? 1 : 0;
    next.brake = b.brake;
    next.boost = b.boost;
    onInputChange(next);
  };

  const bottom = insets.bottom + EDGE_PADDING;

  return (
    <View style={styles.overlay}>
      <View style={[styles.cluster, { bottom, left: insets.left + EDGE_PADDING }]}>
        <HoldButton label="◀" onPressedChange={(p) => setPressed("left", p)} style={styles.round} />
        <HoldButton label="▶" onPressedChange={(p) => setPressed("right", p)} style={styles.round} />
      </View>

      <View style={[styles.cluster, styles.alignEnd, { bottom, right: insets.right + EDGE_PADDING }]}>
        <HoldButton label="BRAKE" onPressedChange={(p) => setPressed("brake", p)} style={[styles.round, styles.brake]} />
        <View style={styles.column}>
          <HoldButton label="BOOST" onPressedChange={(p) => setPressed("boost", p)} style={[styles.boost]} />
          <HoldButton label="GAS" onPressedChange={(p) => setPressed("throttle", p)} style={[styles.round, styles.throttle]} />
        </View>
      </View>
    </View>
  );
}

interface HoldButtonProps {
  label: string;
  onPressedChange: (pressed: boolean) => void;
  style?: StyleProp<ViewStyle>;
}

/** A press-and-hold button. Each one is its own gesture, so multi-touch works. */
function HoldButton({ label, onPressedChange, style }: HoldButtonProps) {
  const pressed = useSharedValue(0);

  const gesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(0)
        .maxDistance(UNLIMITED_DISTANCE)
        .shouldCancelWhenOutside(false)
        .runOnJS(true)
        .onBegin(() => {
          pressed.set(withTiming(1, PRESS_TIMING));
          onPressedChange(true);
        })
        .onFinalize(() => {
          pressed.set(withTiming(0, PRESS_TIMING));
          onPressedChange(false);
        }),
    [pressed, onPressedChange],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + pressed.get() * 0.4,
    transform: [{ scale: 1 - pressed.get() * 0.08 }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.button, style, animatedStyle]}>
        <Text style={styles.label}>{label}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, pointerEvents: "box-none" },
  cluster: { position: "absolute", flexDirection: "row", gap: 16 },
  alignEnd: { alignItems: "flex-end" },
  column: { gap: 12, alignItems: "center" },
  button: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20,20,20,0.75)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
  },
  round: { width: BUTTON_SIZE, height: BUTTON_SIZE, borderRadius: BUTTON_SIZE / 2 },
  throttle: { height: THROTTLE_HEIGHT, backgroundColor: "rgba(30,140,60,0.8)" },
  brake: { backgroundColor: "rgba(170,30,30,0.8)" },
  boost: { width: BOOST_SIZE, height: BOOST_SIZE, borderRadius: BOOST_SIZE / 2, backgroundColor: "rgba(200,150,0,0.8)" },
  label: { color: "white", fontSize: 16, fontWeight: "900" },
});
