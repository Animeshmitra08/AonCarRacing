import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { MENU_COLORS } from "@/menu/MenuTheme";

import { loadGameAssets } from "./loadGameAssets";

/** Shown at least this long so the screen never just flashes. */
const MIN_VISIBLE_MS = 900;
const FADE_OUT_MS = 350;
const PROGRESS_TIMING = { duration: 250, easing: Easing.out(Easing.quad) } as const;
const BAR = { width: 320, height: 12 } as const;
const STRIPE = { width: 26, gap: 70, count: 14, cycleMs: 900 } as const;

const TIPS = [
  "Hold BOOST on the straights. It recharges when you let go.",
  "Turn on tilt steering in Settings to drive like a steering wheel.",
  "Customise your paint, rims and calipers in the Garage.",
  "Race friends: one phone hosts a room, others join with the code.",
  "Brake before hairpins. Alpine Pass punishes late braking.",
];

interface LoadingScreenProps {
  /** Called once loading is done and the fade-out has finished. */
  onFinished: () => void;
}

/** Full-screen overlay that loads game assets, then fades away to reveal the app. */
export function LoadingScreen({ onFinished }: LoadingScreenProps) {
  const [label, setLabel] = useState("Starting engine");
  const [percent, setPercent] = useState(0);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const progress = useSharedValue(0);
  const opacity = useSharedValue(1);
  const stripes = useSharedValue(0);

  useEffect(() => {
    stripes.set(withRepeat(withTiming(1, { duration: STRIPE.cycleMs, easing: Easing.linear }), -1, false));
  }, [stripes]);

  useEffect(() => {
    let cancelled = false;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    loadGameAssets((fraction, step) => {
      if (cancelled) return;
      progress.set(withTiming(fraction, PROGRESS_TIMING));
      setPercent(Math.round(fraction * 100));
      setLabel(step);
    }).then(() => {
      if (cancelled) return;
      const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt));
      fadeTimer = setTimeout(() => {
        opacity.set(withTiming(0, { duration: FADE_OUT_MS }));
        fadeTimer = setTimeout(onFinished, FADE_OUT_MS);
      }, wait);
    });

    return () => {
      cancelled = true;
      clearTimeout(fadeTimer);
    };
    // Load exactly once; `onFinished` is only read after loading completes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const fillStyle = useAnimatedStyle(() => ({ width: progress.get() * BAR.width }));

  return (
    <Animated.View style={[styles.root, rootStyle]} onLayout={() => SplashScreen.hide()}>
      <SpeedStripes phase={stripes} />

      <View style={styles.content}>
        <Text style={styles.title}>
          CAR <Text style={styles.titleAccent}>RACING</Text>
        </Text>

        <View style={styles.bar}>
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.label}>{label.toUpperCase()}…</Text>
          <Text style={styles.percent}>{percent}%</Text>
        </View>
      </View>

      <Text style={styles.tip}>TIP · {tip}</Text>
    </Animated.View>
  );
}

/** Diagonal stripes sliding past, for a sense of speed while waiting. */
function SpeedStripes({ phase }: { phase: SharedValue<number> }) {
  const { height } = useWindowDimensions();
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -phase.get() * (STRIPE.width + STRIPE.gap) }, { skewX: "-24deg" }],
  }));
  return (
    <Animated.View style={[styles.stripes, style]}>
      {Array.from({ length: STRIPE.count }, (_, i) => (
        <View key={i} style={[styles.stripe, { height: height * 1.4 }]} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: MENU_COLORS.background,
  },
  stripes: {
    position: "absolute",
    top: "-20%",
    left: 0,
    flexDirection: "row",
    gap: STRIPE.gap,
    opacity: 0.06,
    pointerEvents: "none",
  },
  stripe: { width: STRIPE.width, backgroundColor: MENU_COLORS.text },
  content: { alignItems: "center", gap: 18 },
  title: { color: MENU_COLORS.text, fontSize: 48, fontWeight: "900", fontStyle: "italic", letterSpacing: 2 },
  titleAccent: { color: MENU_COLORS.accent },
  bar: {
    width: BAR.width,
    height: BAR.height,
    overflow: "hidden",
    backgroundColor: MENU_COLORS.panelRaised,
    transform: [{ skewX: "-20deg" }],
  },
  fill: { height: "100%", backgroundColor: MENU_COLORS.highlight },
  statusRow: { width: BAR.width, flexDirection: "row", justifyContent: "space-between" },
  label: { color: MENU_COLORS.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  percent: { color: MENU_COLORS.text, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  tip: {
    position: "absolute",
    bottom: 28,
    paddingHorizontal: 32,
    textAlign: "center",
    color: MENU_COLORS.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
});
