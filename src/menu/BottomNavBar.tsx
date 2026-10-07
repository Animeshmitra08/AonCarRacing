import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState, type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { MENU_COLORS } from "./MenuTheme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export interface NavTab<K extends string> {
  key: K;
  label: string;
  icon: IconName;
}

interface PrimaryAction {
  label: string;
  onPress: () => void;
}

interface BottomNavBarProps<K extends string> {
  tabs: readonly NavTab<K>[];
  active: K;
  onChange: (key: K) => void;
  /** Big call-to-action on the right; hidden when null. */
  primary: PrimaryAction | null;
  bottomInset: number;
  sideInset: number;
}

export const NAV_BAR_HEIGHT = 64;
const ICON_SIZE = 22;
const INDICATOR_HEIGHT = 3;
const PRIMARY_SKEW = "-14deg";
const PRIMARY_UNSKEW = "14deg";
/** The slanted button extends past the screen edge so its right side stays square-on. */
const PRIMARY_OVERHANG = 16;
const PRIMARY_PADDING = 28;
const SPRING = { damping: 18, stiffness: 220 } as const;

interface TabLayout {
  x: number;
  width: number;
}

export function BottomNavBar<K extends string>({
  tabs,
  active,
  onChange,
  primary,
  bottomInset,
  sideInset,
}: BottomNavBarProps<K>) {
  const [layouts, setLayouts] = useState<Partial<Record<K, TabLayout>>>({});
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  const activeLayout = layouts[active];
  useEffect(() => {
    if (!activeLayout) return;
    indicatorX.set(withSpring(activeLayout.x, SPRING));
    indicatorWidth.set(withSpring(activeLayout.width, SPRING));
  }, [activeLayout, indicatorX, indicatorWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: indicatorWidth.get(),
    transform: [{ translateX: indicatorX.get() }],
  }));

  const handleTabLayout = (key: K) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setLayouts((current) => {
      const previous = current[key];
      return previous && previous.x === x && previous.width === width ? current : { ...current, [key]: { x, width } };
    });
  };

  return (
    <View style={[styles.bar, { height: NAV_BAR_HEIGHT + bottomInset }]}>
      <View style={[styles.tabs, { paddingLeft: sideInset, paddingBottom: bottomInset }]}>
        <Animated.View style={[styles.indicator, indicatorStyle]} />
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onChange(tab.key)}
              onLayout={handleTabLayout(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <Ionicons name={tab.icon} size={ICON_SIZE} color={selected ? MENU_COLORS.highlight : MENU_COLORS.textMuted} />
              <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {primary && (
        <Pressable
          onPress={primary.onPress}
          style={({ pressed }) => [
            styles.primary,
            { paddingRight: sideInset + PRIMARY_OVERHANG + PRIMARY_PADDING, paddingBottom: bottomInset },
            pressed && styles.primaryPressed,
          ]}
        >
          <View style={styles.primaryContent}>
            <Text style={styles.primaryText}>{primary.label}</Text>
            <Ionicons name="play" size={ICON_SIZE} color={MENU_COLORS.onHighlight} />
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    backgroundColor: MENU_COLORS.bar,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  tabs: { flex: 1, flexDirection: "row", alignItems: "stretch" },
  indicator: {
    position: "absolute",
    top: 0,
    left: 0,
    height: INDICATOR_HEIGHT,
    borderBottomLeftRadius: INDICATOR_HEIGHT,
    borderBottomRightRadius: INDICATOR_HEIGHT,
    backgroundColor: MENU_COLORS.highlight,
  },
  tab: { paddingHorizontal: 18, alignItems: "center", justifyContent: "center", gap: 3 },
  pressed: { opacity: 0.6 },
  tabLabel: { color: MENU_COLORS.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  tabLabelActive: { color: MENU_COLORS.text },
  primary: {
    justifyContent: "center",
    paddingLeft: 40,
    marginRight: -PRIMARY_OVERHANG,
    backgroundColor: MENU_COLORS.highlight,
    transform: [{ skewX: PRIMARY_SKEW }],
  },
  primaryPressed: { opacity: 0.85 },
  primaryContent: { flexDirection: "row", alignItems: "center", gap: 8, transform: [{ skewX: PRIMARY_UNSKEW }] },
  primaryText: { color: MENU_COLORS.onHighlight, fontSize: 22, fontWeight: "900", fontStyle: "italic", letterSpacing: 2 },
});
