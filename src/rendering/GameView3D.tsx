import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import type { GameEngine } from "@/game/engine/GameEngine";

import { ThreeWorldView, type ThreeWorldViewOptions } from "./three/ThreeWorldView";
import type { GameRenderer } from "./useGameRenderer";

interface GameView3DProps {
  engine: GameEngine;
  renderer: GameRenderer;
  viewOptions: ThreeWorldViewOptions;
  /** 0..1 fraction of native resolution. */
  renderScale: number;
}

/**
 * Hosts the GL surface. The 3D view is drawn from the engine's frame callback
 * on the JS thread, right after simulation, so React never re-renders per frame.
 *
 * Lower render scales shrink the GL view (so its drawing buffer has fewer pixels)
 * and scale it back up to fill the screen.
 */
export function GameView3D({ engine, renderer, viewOptions, renderScale }: GameView3DProps) {
  const { width, height } = useWindowDimensions();
  useEffect(() => () => renderer.setView(null), [renderer]);

  const handleContextCreate = (gl: ExpoWebGLRenderingContext) => {
    renderer.setView(new ThreeWorldView(gl, engine.state.track, engine.state.cars, viewOptions));
  };

  const scaledWidth = width * renderScale;
  const scaledHeight = height * renderScale;
  const glStyle = {
    position: "absolute",
    width: scaledWidth,
    height: scaledHeight,
    left: (width - scaledWidth) / 2,
    top: (height - scaledHeight) / 2,
    transform: [{ scale: 1 / renderScale }],
  } as const;

  return (
    <View style={styles.container}>
      <GLView style={glStyle} onContextCreate={handleContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFill, overflow: "hidden" },
});
