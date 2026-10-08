import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";

import { clamp } from "@/game/math/geometry";

export const WHEEL_SIZE = 150;
/** Wheel rotation (degrees) at full steering lock. Less than a real car: thumbs can't cross over. */
const FULL_LOCK_DEGREES = 90;
const FULL_LOCK = (FULL_LOCK_DEGREES * Math.PI) / 180;
/** Touches this close to the hub are ignored: the angle there is too jumpy. */
const DEAD_HUB_RATIO = 0.18;
const RIM = WHEEL_SIZE * 0.11;
const SPOKE = WHEEL_SIZE * 0.085;
const HUB = WHEEL_SIZE * 0.3;
const MARKER = { width: WHEEL_SIZE * 0.07, height: RIM } as const;

interface SteeringWheelProps {
  /** Displayed steering, -1..1. Driven by the parent (tilt, release spring) and by dragging. */
  steering: SharedValue<number>;
  /** Called with -1..1 while the wheel is being turned. */
  onTurn: (steering: number) => void;
  onRelease: () => void;
}

/**
 * On-screen steering wheel: put a thumb on it and turn it like a real wheel.
 * The grab is relative, so the wheel never jumps to where you touched.
 */
export function SteeringWheel({ steering, onTurn, onRelease }: SteeringWheelProps) {
  // Drag state lives in shared values: safe to read/write from gesture callbacks.
  const lastTouchAngle = useSharedValue(0);
  const rotation = useSharedValue(0);
  const tracking = useSharedValue(false);

  const gesture = useMemo(() => {
    const touchAngle = (x: number, y: number): number | null => {
      const dx = x - WHEEL_SIZE / 2;
      const dy = y - WHEEL_SIZE / 2;
      if (Math.hypot(dx, dy) < WHEEL_SIZE * DEAD_HUB_RATIO) return null;
      return Math.atan2(dx, -dy); // 0 at 12 o'clock, clockwise positive
    };
    return Gesture.Pan()
      .minDistance(0)
      .maxPointers(1)
      // Keep turning even when the thumb slides off the wheel.
      .shouldCancelWhenOutside(false)
      .runOnJS(true)
      .onBegin((event) => {
        // Start from wherever the wheel is now (e.g. tilted), so grabbing never jumps it.
        const angle = touchAngle(event.x, event.y);
        lastTouchAngle.set(angle ?? 0);
        tracking.set(angle !== null);
        rotation.set(steering.get() * FULL_LOCK);
      })
      .onUpdate((event) => {
        const angle = touchAngle(event.x, event.y);
        if (angle === null) return;
        if (!tracking.get()) {
          lastTouchAngle.set(angle);
          tracking.set(true);
          return;
        }
        // Unwrap so crossing 6 o'clock doesn't flip the wheel.
        let delta = angle - lastTouchAngle.get();
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        lastTouchAngle.set(angle);
        rotation.set(clamp(rotation.get() + delta, -FULL_LOCK, FULL_LOCK));
        const value = rotation.get() / FULL_LOCK;
        steering.set(value);
        onTurn(value);
      })
      .onFinalize(() => onRelease());
  }, [steering, lastTouchAngle, rotation, tracking, onTurn, onRelease]);

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${steering.get() * FULL_LOCK_DEGREES}deg` }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.touchArea}>
        <Animated.View style={[styles.wheel, rotateStyle]}>
          <View style={[styles.spoke, styles.spokeLeft]} />
          <View style={[styles.spoke, styles.spokeRight]} />
          <View style={[styles.spoke, styles.spokeBottom]} />
          <View style={styles.hub} />
          <View style={styles.marker} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const RIM_COLOR = "rgba(235,236,240,0.92)";
const SPOKE_COLOR = "rgba(200,202,208,0.9)";

const styles = StyleSheet.create({
  touchArea: { width: WHEEL_SIZE, height: WHEEL_SIZE },
  wheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    borderWidth: RIM,
    borderColor: RIM_COLOR,
    backgroundColor: "rgba(15,15,18,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  spoke: { position: "absolute", backgroundColor: SPOKE_COLOR, borderRadius: SPOKE / 2 },
  spokeLeft: { left: 0, width: WHEEL_SIZE / 2 - RIM, height: SPOKE },
  spokeRight: { right: 0, width: WHEEL_SIZE / 2 - RIM, height: SPOKE },
  spokeBottom: { bottom: 0, height: WHEEL_SIZE / 2 - RIM, width: SPOKE },
  hub: {
    width: HUB,
    height: HUB,
    borderRadius: HUB / 2,
    backgroundColor: "rgba(30,30,34,0.95)",
    borderWidth: 2,
    borderColor: SPOKE_COLOR,
  },
  /** Racing-style 12 o'clock stripe, so the wheel's rotation is easy to read. */
  marker: {
    position: "absolute",
    top: -RIM,
    width: MARKER.width,
    height: MARKER.height,
    backgroundColor: "#e63946",
  },
});
