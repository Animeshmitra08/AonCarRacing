import { Canvas, Path } from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import type { TrackDefinition, TrackEnvironment } from "@/game/entities/Track";
import { getBuiltTrack } from "@/game/tracks";
import { formatTicks } from "@/hud/format";
import { METERS_PER_WORLD_UNIT } from "@/rendering/RenderConstants";
import { ENVIRONMENTS } from "@/rendering/three/SceneConstants";
import { createTrackOutline } from "@/rendering/trackOutline";

import { MENU_COLORS } from "./MenuTheme";

export const TRACK_CARD_WIDTH = 190;
const PREVIEW_HEIGHT = 110;
const PREVIEW_PADDING = 12;
const SELECTED_SCALE = 1;
const UNSELECTED_SCALE = 0.94;

const ENVIRONMENT_LABELS: Record<TrackEnvironment, string> = {
  meadow: "Meadow",
  desert: "Desert",
  snow: "Snow",
};

interface TrackCardProps {
  definition: TrackDefinition;
  selected: boolean;
  onSelect: (definition: TrackDefinition) => void;
  /** Personal best lap on this track, if any (simulation ticks). */
  bestLapTicks: number | null;
}

export function TrackCard({ definition, selected, onSelect, bestLapTicks }: TrackCardProps) {
  const track = getBuiltTrack(definition);
  const outline = useMemo(
    () => createTrackOutline(track, TRACK_CARD_WIDTH, PREVIEW_HEIGHT, PREVIEW_PADDING),
    [track],
  );
  const lengthMeters = Math.round(track.length * METERS_PER_WORLD_UNIT);

  const scale = useSharedValue(selected ? SELECTED_SCALE : UNSELECTED_SCALE);
  useEffect(() => {
    scale.set(withSpring(selected ? SELECTED_SCALE : UNSELECTED_SCALE));
  }, [scale, selected]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable onPress={() => onSelect(definition)}>
      <Animated.View style={[styles.card, selected && styles.cardSelected, animatedStyle]}>
        <View style={[styles.preview, { backgroundColor: ENVIRONMENTS[definition.environment].ground }]}>
          <Canvas style={styles.canvas}>
            <Path path={outline.path} style="stroke" strokeWidth={outline.roadWidth + 2} strokeJoin="round" color="white" />
            <Path path={outline.path} style="stroke" strokeWidth={outline.roadWidth} strokeJoin="round" color="#3b3d42" />
          </Canvas>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{definition.name}</Text>
          <Text style={styles.meta}>
            {ENVIRONMENT_LABELS[definition.environment]} · {lengthMeters} m
          </Text>
          <Text style={[styles.meta, bestLapTicks !== null && styles.best]}>
            {bestLapTicks !== null ? `BEST LAP ${formatTicks(bestLapTicks)}` : "No lap record yet"}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: TRACK_CARD_WIDTH,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: MENU_COLORS.panel,
    borderWidth: 2,
    borderColor: "transparent",
    opacity: 0.75,
  },
  cardSelected: { borderColor: MENU_COLORS.accent, opacity: 1 },
  preview: { height: PREVIEW_HEIGHT },
  canvas: { width: TRACK_CARD_WIDTH, height: PREVIEW_HEIGHT },
  info: { paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  name: { color: MENU_COLORS.text, fontSize: 16, fontWeight: "900" },
  meta: { color: MENU_COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  best: { color: MENU_COLORS.highlight, fontWeight: "900", fontVariant: ["tabular-nums"] },
});
