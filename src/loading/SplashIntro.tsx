import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { MENU_COLORS } from "@/menu/MenuTheme";

// White, tightly cropped copy of carseloute.png; the native splash uses the same file.
const CAR_SOURCE = require("@/assets/images/splash-car.png");
const CAR_ASPECT = 365 / 131;
/** Must match `imageWidth` of the expo-splash-screen plugin in app.json, so the handoff is seamless. */
const NATIVE_CAR_WIDTH = 170;
const CAR = { width: 300, height: 300 / CAR_ASPECT } as const;

/** Milliseconds from mount. */
const T = {
  zoomMs: 500,
  lightsAt: [450, 800, 1150],
  goAt: 1500,
  squatMs: 110,
  launchMs: 520,
  titleAt: 1850,
  titleMs: 420,
  fadeAt: 2750,
  fadeMs: 300,
} as const;

const IDLE = { jitterPx: 1.2, cycleMs: 70 } as const;
const LAUNCH = { squatPx: 14, noseLiftDeg: 2.5 } as const;
const GHOSTS = [
  { spacing: 28, opacity: 0.35 },
  { spacing: 56, opacity: 0.2 },
  { spacing: 84, opacity: 0.1 },
] as const;
/** One loop of the shared speed phase; road dashes and streaks move whole laps per loop so it wraps seamlessly. */
const SPEED_CYCLE_MS = 900;
const DASH = { width: 34, gap: 38, laps: 12 } as const;
const STREAK_COUNT = 12;
const GO_GREEN = "#2ecc71";

interface Streak {
  y: number;
  length: number;
  laps: number;
  offset: number;
  alpha: number;
}

function makeStreaks(): Streak[] {
  return Array.from({ length: STREAK_COUNT }, () => ({
    y: 0.08 + Math.random() * 0.84,
    length: 60 + Math.random() * 140,
    laps: 1 + Math.floor(Math.random() * 3),
    offset: Math.random(),
    alpha: 0.15 + Math.random() * 0.35,
  }));
}

interface SplashIntroProps {
  /** Called once the intro has faded out (or straight away when the OS asks for reduced motion). */
  onFinished: () => void;
}

/**
 * Animated intro over the loading screen: start lights count down, the car launches off-screen
 * and the title slams in. Picks up exactly where the native splash (same car, same spot) leaves off.
 * Tap anywhere to skip.
 */
export function SplashIntro({ onFinished }: SplashIntroProps) {
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const [lit, setLit] = useState(0);
  const [go, setGo] = useState(false);
  const [streaks] = useState(makeStreaks);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finishing = useRef(false);

  const zoom = useSharedValue(NATIVE_CAR_WIDTH / CAR.width);
  const idle = useSharedValue(0.5);
  const carX = useSharedValue(0);
  const tilt = useSharedValue(0);
  const trail = useSharedValue(0);
  const rush = useSharedValue(0);
  const speed = useSharedValue(0);
  const title = useSharedValue(0);
  const opacity = useSharedValue(1);

  const finish = () => {
    if (finishing.current) return;
    finishing.current = true;
    timers.current.forEach(clearTimeout);
    opacity.set(withTiming(0, { duration: T.fadeMs }));
    timers.current = [setTimeout(onFinished, T.fadeMs)];
  };

  useEffect(() => {
    if (reduceMotion) {
      onFinished();
      return;
    }
    const pending: ReturnType<typeof setTimeout>[] = [];
    timers.current = pending;
    const at = (ms: number, run: () => void) => pending.push(setTimeout(run, ms));

    zoom.set(withTiming(1, { duration: T.zoomMs, easing: Easing.out(Easing.cubic) }));
    idle.set(withRepeat(withTiming(1, { duration: IDLE.cycleMs, easing: Easing.inOut(Easing.sin) }), -1, true));
    T.lightsAt.forEach((ms, i) => at(ms, () => setLit(i + 1)));

    at(T.goAt, () => {
      setGo(true);
      idle.set(withTiming(0.5, { duration: T.squatMs }));
      carX.set(
        withSequence(
          withTiming(LAUNCH.squatPx, { duration: T.squatMs, easing: Easing.out(Easing.quad) }),
          withTiming(-(width / 2 + CAR.width), { duration: T.launchMs, easing: Easing.in(Easing.cubic) }),
        ),
      );
      tilt.set(
        withSequence(
          withTiming(LAUNCH.noseLiftDeg, { duration: T.squatMs }),
          withTiming(0, { duration: T.launchMs }),
        ),
      );
      trail.set(withDelay(T.squatMs, withTiming(1, { duration: T.launchMs * 0.6 })));
      rush.set(withTiming(1, { duration: 250 }));
      speed.set(withRepeat(withTiming(1, { duration: SPEED_CYCLE_MS, easing: Easing.linear }), -1, false));
    });

    at(T.titleAt, () => title.set(withTiming(1, { duration: T.titleMs, easing: Easing.out(Easing.back(1.6)) })));
    at(T.fadeAt, finish);

    return () => pending.forEach(clearTimeout);
    // Play exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: carX.get() },
      { translateY: (idle.get() - 0.5) * 2 * IDLE.jitterPx },
      { rotate: `${tilt.get()}deg` },
      { scale: zoom.get() },
    ],
  }));
  const zoomStart = NATIVE_CAR_WIDTH / CAR.width;
  const roadStyle = useAnimatedStyle(() => ({ opacity: (zoom.get() - zoomStart) / (1 - zoomStart) }));
  const dashesStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ((speed.get() * DASH.laps) % 1) * (DASH.width + DASH.gap) }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, title.get() * 2),
    transform: [{ translateX: (1 - title.get()) * width * 0.6 }, { skewX: `${(1 - title.get()) * -20}deg` }],
  }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  if (reduceMotion) return null;

  const dashCount = Math.ceil(width / (DASH.width + DASH.gap)) + 2;

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      <Pressable style={styles.stage} onPress={finish} accessibilityLabel="Skip intro">
        {streaks.map((streak, i) => (
          <SpeedStreak key={i} streak={streak} phase={speed} rush={rush} screenWidth={width} />
        ))}

        <Animated.View style={[styles.road, roadStyle]}>
          <View style={styles.roadEdge} />
          <Animated.View style={[styles.dashes, dashesStyle]}>
            {Array.from({ length: dashCount }, (_, i) => (
              <View key={i} style={styles.dash} />
            ))}
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.car, carStyle]}>
          {GHOSTS.map((ghost, i) => (
            <Ghost key={i} spacing={ghost.spacing} maxOpacity={ghost.opacity} trail={trail} />
          ))}
          <Image source={CAR_SOURCE} style={styles.carImage} contentFit="contain" />
        </Animated.View>

        <View style={styles.lights}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.light, go ? styles.lightGo : i < lit && styles.lightRed]} />
          ))}
        </View>

        <Animated.View style={[styles.titleWrap, titleStyle]}>
          <Text style={styles.title}>
            CAR <Text style={styles.titleAccent}>RACING</Text>
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** Fading copy of the car trailing behind it, for motion blur. */
function Ghost({ spacing, maxOpacity, trail }: { spacing: number; maxOpacity: number; trail: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: trail.get() * maxOpacity,
    transform: [{ translateX: trail.get() * spacing }],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Image source={CAR_SOURCE} style={styles.carImage} contentFit="contain" />
    </Animated.View>
  );
}

/** Horizontal streak rushing past once the race starts. */
function SpeedStreak({
  streak,
  phase,
  rush,
  screenWidth,
}: {
  streak: Streak;
  phase: SharedValue<number>;
  rush: SharedValue<number>;
  screenWidth: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = (phase.get() * streak.laps + streak.offset) % 1;
    return {
      opacity: rush.get() * streak.alpha,
      transform: [{ translateX: -streak.length + t * (screenWidth + streak.length) }],
    };
  });
  return <Animated.View style={[styles.streak, { top: `${streak.y * 100}%`, width: streak.length }, style]} />;
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: MENU_COLORS.background,
  },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  streak: {
    position: "absolute",
    left: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: MENU_COLORS.text,
  },
  road: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    marginTop: CAR.height / 2 - 4,
    gap: 14,
  },
  roadEdge: { height: 2, backgroundColor: MENU_COLORS.panelRaised },
  dashes: {
    flexDirection: "row",
    gap: DASH.gap,
    marginLeft: -(DASH.width + DASH.gap),
  },
  dash: { width: DASH.width, height: 4, backgroundColor: MENU_COLORS.highlight, opacity: 0.7 },
  car: { width: CAR.width, height: CAR.height },
  carImage: { width: "100%", height: "100%" },
  lights: {
    position: "absolute",
    top: "10%",
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: MENU_COLORS.bar,
  },
  light: { width: 26, height: 26, borderRadius: 13, backgroundColor: MENU_COLORS.panelRaised },
  lightRed: { backgroundColor: MENU_COLORS.accent, boxShadow: `0 0 16px ${MENU_COLORS.accent}` },
  lightGo: { backgroundColor: GO_GREEN, boxShadow: `0 0 16px ${GO_GREEN}` },
  titleWrap: { position: "absolute" },
  title: { color: MENU_COLORS.text, fontSize: 56, fontWeight: "900", fontStyle: "italic", letterSpacing: 2 },
  titleAccent: { color: MENU_COLORS.accent },
});
