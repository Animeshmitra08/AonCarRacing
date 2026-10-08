import {
  Canvas,
  Circle,
  createPicture,
  Group,
  LinearGradient,
  PaintStyle,
  Path,
  Picture,
  Rect,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

const C = {
  skyTop: "#05061a",
  skyMid: "#1d1240",
  skyHorizon: "#ff4f6d",
  sunTop: "#ffe66b",
  sunBottom: "#ff3d8b",
  mountainFar: "#2a1650",
  mountainNear: "#160b30",
  ground: "#0a0618",
  grid: "#b03bff",
  road: "#120d22",
  roadEdge: "#3ef0ff",
  dash: "#ffd166",
  star: "#ffffff",
} as const;

/** Horizon height as a fraction of screen height. */
const HORIZON = 0.56;
const ROAD = { topHalfWidth: 0.012, bottomHalfWidth: 0.42 } as const;
const GRID = { verticalLines: 18, horizontalLines: 14 } as const;
const DASHES = 9;
const CYCLE_MS = 1100;
/** Larger = stronger perspective (lines bunch up near the horizon). */
const PERSPECTIVE = 2.3;
const STAR_COUNT = 60;
const SUN = { radiusRatio: 0.24, stripes: 6 } as const;

/**
 * Synthwave "night drive" backdrop for the login screen: neon sun, mountains and a
 * road rushing toward the viewer. Moving parts are one Skia picture per frame (UI thread).
 */
export function LoginBackground() {
  const { width: W, height: H } = useWindowDimensions();
  const horizon = H * HORIZON;
  const phase = useSharedValue(0);

  useEffect(() => {
    phase.set(withRepeat(withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }), -1, false));
  }, [phase]);

  const statics = useMemo(() => {
    const stars = Array.from({ length: STAR_COUNT }, (_, i) => {
      // Deterministic scatter (no flicker on re-render).
      const a = Math.sin(i * 12.9898) * 43758.5453;
      const b = Math.sin(i * 78.233) * 12543.123;
      return { x: (a - Math.floor(a)) * W, y: (b - Math.floor(b)) * horizon * 0.8, r: 0.6 + ((a * 7) % 1) * 1.1 };
    });
    const far = Skia.PathBuilder.Make();
    far.moveTo(0, horizon);
    for (let x = 0; x <= W; x += W / 12) far.lineTo(x, horizon - H * (0.06 + 0.07 * Math.abs(Math.sin(x * 0.013))));
    far.lineTo(W, horizon).close();
    const near = Skia.PathBuilder.Make();
    near.moveTo(0, horizon);
    for (let x = 0; x <= W; x += W / 8) near.lineTo(x, horizon - H * (0.02 + 0.05 * Math.abs(Math.cos(x * 0.009 + 1))));
    near.lineTo(W, horizon).close();
    return { stars, farMountains: far.detach(), nearMountains: near.detach() };
  }, [W, H, horizon]);

  const sunRadius = H * SUN.radiusRatio;
  const sunCenter = vec(W / 2, horizon - sunRadius * 0.35);

  const ground = useDerivedValue(() => {
    const t = phase.get();
    const depth = H - horizon;
    const vx = W / 2;
    // z in (0, 1]: 0 at the horizon, 1 at the bottom of the screen.
    const yAt = (z: number) => horizon + depth * Math.pow(z, PERSPECTIVE);
    const halfAt = (y: number) =>
      W * (ROAD.topHalfWidth + (ROAD.bottomHalfWidth - ROAD.topHalfWidth) * ((y - horizon) / depth));

    return createPicture((canvas) => {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);

      paint.setColor(Skia.Color(C.ground));
      canvas.drawRect(Skia.XYWHRect(0, horizon, W, depth), paint);

      // Neon grid: lines fanning from the vanishing point, plus rows sliding toward the viewer.
      paint.setColor(Skia.Color(C.grid));
      paint.setStyle(PaintStyle.Stroke);
      for (let i = -GRID.verticalLines; i <= GRID.verticalLines; i++) {
        paint.setAlphaf(0.35);
        paint.setStrokeWidth(1);
        canvas.drawLine(vx, horizon, vx + i * (W / GRID.verticalLines) * 2.2, H, paint);
      }
      for (let k = 0; k < GRID.horizontalLines; k++) {
        const z = (k + t) / GRID.horizontalLines;
        const y = yAt(z);
        paint.setAlphaf(0.15 + 0.55 * z);
        paint.setStrokeWidth(0.5 + 1.5 * z);
        canvas.drawLine(0, y, W, y, paint);
      }

      // Road on top of the grid.
      paint.setStyle(PaintStyle.Fill);
      paint.setAlphaf(1);
      paint.setColor(Skia.Color(C.road));
      const road = Skia.PathBuilder.Make()
        .moveTo(vx - halfAt(horizon), horizon)
        .lineTo(vx + halfAt(horizon), horizon)
        .lineTo(vx + halfAt(H), H)
        .lineTo(vx - halfAt(H), H)
        .close()
        .detach();
      canvas.drawPath(road, paint);

      paint.setStyle(PaintStyle.Stroke);
      paint.setColor(Skia.Color(C.roadEdge));
      paint.setStrokeWidth(3);
      canvas.drawLine(vx - halfAt(horizon), horizon, vx - halfAt(H), H, paint);
      canvas.drawLine(vx + halfAt(horizon), horizon, vx + halfAt(H), H, paint);

      // Centre dashes rushing toward the viewer.
      paint.setStyle(PaintStyle.Fill);
      paint.setColor(Skia.Color(C.dash));
      for (let k = 0; k < DASHES; k++) {
        const z0 = (k + t) / DASHES;
        const z1 = Math.min(1, z0 + 0.45 / DASHES);
        const y0 = yAt(z0);
        const y1 = yAt(z1);
        const w0 = halfAt(y0) * 0.035;
        const w1 = halfAt(y1) * 0.035;
        const dash = Skia.PathBuilder.Make()
          .moveTo(vx - w0, y0)
          .lineTo(vx + w0, y0)
          .lineTo(vx + w1, y1)
          .lineTo(vx - w1, y1)
          .close()
          .detach();
        paint.setAlphaf(0.4 + 0.6 * z0);
        canvas.drawPath(dash, paint);
      }
    });
  });

  return (
    <Canvas style={styles.canvas}>
      <Rect x={0} y={0} width={W} height={horizon}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, horizon)}
          colors={[C.skyTop, C.skyMid, C.skyHorizon]}
          positions={[0, 0.6, 1]}
        />
      </Rect>
      {statics.stars.map((s, i) => (
        <Circle key={i} cx={s.x} cy={s.y} r={s.r} color={C.star} opacity={0.7} />
      ))}

      {/* Striped neon sun, clipped at the horizon. */}
      <Group clip={Skia.XYWHRect(0, 0, W, horizon)}>
        <Circle c={sunCenter} r={sunRadius}>
          <LinearGradient
            start={vec(0, sunCenter.y - sunRadius)}
            end={vec(0, sunCenter.y + sunRadius)}
            colors={[C.sunTop, C.sunBottom]}
          />
        </Circle>
        {Array.from({ length: SUN.stripes }, (_, i) => {
          const y = sunCenter.y + (i / SUN.stripes) * sunRadius * 0.9;
          return <Rect key={i} x={0} y={y} width={W} height={2 + i * 1.6} color={C.skyHorizon} opacity={0.9} />;
        })}
      </Group>

      <Path path={statics.farMountains} color={C.mountainFar} />
      <Path path={statics.nearMountains} color={C.mountainNear} />
      <Picture picture={ground} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: { ...StyleSheet.absoluteFill, pointerEvents: "none" },
});
