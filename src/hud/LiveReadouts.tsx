import { Canvas, matchFont, Rect, Text as SkiaText } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { Platform, StyleSheet } from "react-native";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import { SNAP_BOOST, SNAP_RACE_SECONDS, SNAP_SPEED_KMH } from "@/rendering/RenderSnapshot";

import { formatRaceTime } from "./format";

const WIDTH = 170;
const HEIGHT = 74;
const FONT_SIZE = 20;
const LINE_HEIGHT = 26;
const BAR = { y: 60, height: 8 } as const;
const BOOST_COLOR = "#ffbe0b";
const BAR_BG = "rgba(255,255,255,0.2)";

interface LiveReadoutsProps {
  snapshot: SharedValue<number[]>;
}

/**
 * Race clock, speed and boost change every frame, so they're drawn with Skia
 * from the snapshot on the UI thread instead of going through React state.
 */
export function LiveReadouts({ snapshot }: LiveReadoutsProps) {
  const font = useMemo(
    () => matchFont({ fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), fontSize: FONT_SIZE, fontWeight: "bold" }),
    [],
  );

  const time = useDerivedValue(() => formatRaceTime(snapshot.get()[SNAP_RACE_SECONDS]));
  const speed = useDerivedValue(() => `${Math.round(snapshot.get()[SNAP_SPEED_KMH])} km/h`);
  const boostWidth = useDerivedValue(() => WIDTH * snapshot.get()[SNAP_BOOST]);

  return (
    <Canvas style={styles.canvas}>
      <SkiaText x={0} y={FONT_SIZE} text={time} font={font} color="white" />
      <SkiaText x={0} y={FONT_SIZE + LINE_HEIGHT} text={speed} font={font} color="white" />
      <Rect x={0} y={BAR.y} width={WIDTH} height={BAR.height} color={BAR_BG} />
      <Rect x={0} y={BAR.y} width={boostWidth} height={BAR.height} color={BOOST_COLOR} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: { width: WIDTH, height: HEIGHT },
});
