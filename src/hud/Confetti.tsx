import { Canvas, createPicture, Picture, Skia } from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { Easing, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";

const PIECES = 90;
const DURATION_S = 4;
const FADE_FROM_S = 3;
const GRAVITY = 140;
const SWAY = 22;
const COLORS = ["#ffbe0b", "#e63946", "#1d8cf8", "#2a9d8f", "#ffffff", "#ff006e"] as const;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  phase: number;
  width: number;
  height: number;
  color: number;
}

function createPieces(width: number, height: number): Piece[] {
  return Array.from({ length: PIECES }, () => ({
    x: Math.random() * width,
    y: -Math.random() * height * 0.5 - 20,
    vx: (Math.random() - 0.5) * 80,
    vy: 90 + Math.random() * 160,
    spin: (Math.random() - 0.5) * 720,
    phase: Math.random() * Math.PI * 2,
    width: 6 + Math.random() * 6,
    height: 10 + Math.random() * 8,
    color: Math.floor(Math.random() * COLORS.length),
  }));
}

/**
 * Falling confetti, drawn into a single Skia picture per frame on the UI thread
 * (one draw call for every piece). Plays once on mount.
 */
export function Confetti() {
  const { width, height } = useWindowDimensions();
  const [pieces] = useState(() => createPieces(width, height));
  const time = useSharedValue(0);

  useEffect(() => {
    time.set(withTiming(DURATION_S, { duration: DURATION_S * 1000, easing: Easing.linear }));
  }, [time]);

  const picture = useDerivedValue(() => {
    const t = time.get();
    const alpha = t < FADE_FROM_S ? 1 : Math.max(0, 1 - (t - FADE_FROM_S) / (DURATION_S - FADE_FROM_S));
    return createPicture((canvas) => {
      const paints = COLORS.map((color) => {
        const paint = Skia.Paint();
        paint.setColor(Skia.Color(color));
        paint.setAlphaf(alpha);
        return paint;
      });
      for (const p of pieces) {
        const x = p.x + p.vx * t + Math.sin(t * 3 + p.phase) * SWAY;
        const y = p.y + p.vy * t + 0.5 * GRAVITY * t * t;
        if (y > height + 20) continue;
        canvas.save();
        canvas.translate(x, y);
        canvas.rotate(p.spin * t, 0, 0);
        // Squash horizontally over time so pieces look like they're tumbling.
        const flip = Math.abs(Math.cos(t * 4 + p.phase));
        canvas.drawRect(Skia.XYWHRect((-p.width * flip) / 2, -p.height / 2, p.width * flip, p.height), paints[p.color]);
        canvas.restore();
      }
    });
  });

  return (
    <Canvas style={styles.canvas}>
      <Picture picture={picture} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: { ...StyleSheet.absoluteFill, pointerEvents: "none" },
});
