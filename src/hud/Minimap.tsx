import { Canvas, Circle, Path } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { Car } from "@/game/entities/Car";
import type { Track } from "@/game/entities/Track";
import { SNAP_CAR_STRIDE, SNAP_CARS_OFFSET } from "@/rendering/RenderSnapshot";
import { createTrackOutline, type OutlineTransform } from "@/rendering/trackOutline";

const MAP_SIZE = 130;
const PADDING = 10;
const DOT_RADIUS = 4;
const PLAYER_RING_RADIUS = 6;
const ROAD_COLOR = "rgba(255,255,255,0.45)";

interface MinimapProps {
  track: Track;
  cars: readonly Car[];
  /** Index-aligned with `cars`. */
  carColors: readonly string[];
  playerIndex: number;
  snapshot: SharedValue<number[]>;
}

/** North-up track overview. Car dots move on the UI thread from the snapshot. */
export function Minimap({ track, cars, carColors, playerIndex, snapshot }: MinimapProps) {
  const { transform, path, roadWidth } = useMemo(() => createTrackOutline(track, MAP_SIZE, MAP_SIZE, PADDING), [track]);

  return (
    <Canvas style={styles.canvas}>
      <Path path={path} style="stroke" strokeWidth={roadWidth} strokeJoin="round" color={ROAD_COLOR} />
      {cars.map((car, index) => (
        <MapDot
          key={car.id}
          index={index}
          color={carColors[index]}
          isPlayer={index === playerIndex}
          transform={transform}
          snapshot={snapshot}
        />
      ))}
    </Canvas>
  );
}

interface MapDotProps {
  index: number;
  color: string;
  isPlayer: boolean;
  transform: OutlineTransform;
  snapshot: SharedValue<number[]>;
}

function MapDot({ index, color, isPlayer, transform, snapshot }: MapDotProps) {
  const base = SNAP_CARS_OFFSET + index * SNAP_CAR_STRIDE;
  const { scale, offsetX, offsetY } = transform;
  const cx = useDerivedValue(() => snapshot.get()[base] * scale + offsetX);
  const cy = useDerivedValue(() => snapshot.get()[base + 1] * scale + offsetY);

  return (
    <>
      {isPlayer && <Circle cx={cx} cy={cy} r={PLAYER_RING_RADIUS} color="white" />}
      <Circle cx={cx} cy={cy} r={DOT_RADIUS} color={color} />
    </>
  );
}

const styles = StyleSheet.create({
  canvas: { width: MAP_SIZE, height: MAP_SIZE },
});
