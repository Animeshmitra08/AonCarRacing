import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState, type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { MENU_COLORS } from "./MenuTheme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export interface NavTab<K extends string> {
  key: K;
  label: string;
  icon: IconName;
}

interface BottomNavBarProps<K extends string> {
  tabs: readonly NavTab<K>[];
  active: K;
  onChange: (key: K) => void;
  bottomInset: number;
  leftInset: number;
  rightInset: number;
}

export const NAV_BAR_HEIGHT = 52;
const ICON_SIZE = 20;
const INDICATOR_HEIGHT = 3;
/** A short ease-out slide: settles without overshoot. */
const SLIDE = { duration: 220, easing: Easing.out(Easing.cubic) } as const;

/** Full-width row of equal, rectangular tabs (icon beside label) with a sliding highlight. */
export function BottomNavBar<K extends string>({ tabs, active, onChange, bottomInset, leftInset, rightInset }: BottomNavBarProps<K>) {
  const [rowWidth, setRowWidth] = useState(0);
  const tabWidth = rowWidth / tabs.length;
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.key === active));
  const highlightX = useSharedValue(0);
  const placed = useSharedValue(false);

  useEffect(() => {
    if (tabWidth === 0) return;
    const x = activeIndex * tabWidth;
    // Jump into place on first layout (and after rotation); slide on tab changes.
    highlightX.set(placed.get() ? withTiming(x, SLIDE) : x);
    placed.set(true);
  }, [activeIndex, tabWidth, highlightX, placed]);

  const highlightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: highlightX.get() }] }));

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width !== rowWidth) {
      placed.set(false);
      setRowWidth(width);
    }
  };

  return (
    <View style={[styles.bar, { paddingBottom: bottomInset, paddingLeft: leftInset, paddingRight: rightInset }]}>
      <View style={styles.row} onLayout={handleLayout} accessibilityRole="tablist">
        {tabWidth > 0 && (
          <Animated.View pointerEvents="none" style={[styles.highlight, { width: tabWidth }, highlightStyle]}>
            <View style={styles.indicator} />
          </Animated.View>
        )}
        {tabs.map((tab, index) => {
          const selected = index === activeIndex;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onChange(tab.key)}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected }}
              style={({ pressed }) => [styles.tab, index > 0 && styles.divider, pressed && styles.pressed]}
            >
              <Ionicons name={tab.icon} size={ICON_SIZE} color={selected ? MENU_COLORS.highlight : MENU_COLORS.textMuted} />
              <Text style={[styles.label, selected && styles.labelActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: MENU_COLORS.bar,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  row: { height: NAV_BAR_HEIGHT, flexDirection: "row" },
  highlight: { position: "absolute", top: 0, bottom: 0, left: 0, backgroundColor: "rgba(255,190,11,0.08)" },
  indicator: { height: INDICATOR_HEIGHT, backgroundColor: MENU_COLORS.highlight },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 8 },
  divider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "rgba(255,255,255,0.12)" },
  pressed: { backgroundColor: "rgba(255,255,255,0.05)" },
  label: { color: MENU_COLORS.textMuted, fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  labelActive: { color: MENU_COLORS.text },
});
