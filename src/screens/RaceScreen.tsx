import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { TouchControls } from "@/controls/TouchControls";
import type { CarId } from "@/game/entities/Car";
import { GameEngine } from "@/game/engine/GameEngine";
import type { CarInput } from "@/game/state/CarInput";
import { findTrack } from "@/game/tracks";
import { RaceHud } from "@/hud/RaceHud";
import { resolveCarLook } from "@/rendering/carStyle";
import { GameView3D } from "@/rendering/GameView3D";
import { CAR_COLORS, GRAPHICS_PRESETS } from "@/rendering/RenderConstants";
import { useGameRenderer } from "@/rendering/useGameRenderer";
import { useGameSettings } from "@/settings/GameSettings";

const LOCAL_PLAYER: CarId = "local";

/**
 * Composition root: Input (touch) → GameEngine → 3D view (three.js) + HUD (Skia).
 * Multiplayer will swap where input comes from and who runs the engine; nothing below changes.
 */
export function RaceScreen() {
  // Settings are read once: changing them mid-race would require rebuilding the engine.
  const { settings } = useGameSettings();
  const [race] = useState(() => ({
    engine: new GameEngine({ track: findTrack(settings.trackId), carIds: [LOCAL_PLAYER], laps: settings.laps }),
    carColors: [CAR_COLORS[settings.carColorIndex % CAR_COLORS.length]],
    viewOptions: {
      cameraMode: settings.cameraMode,
      carLooks: [resolveCarLook(settings.carColorIndex, settings.carStyle)],
    },
    renderScale: GRAPHICS_PRESETS[settings.graphicsQuality].renderScale,
  }));
  const { engine, carColors } = race;
  const renderer = useGameRenderer(engine, LOCAL_PLAYER);

  useEffect(() => {
    engine.start();
    engine.startRace();
    return () => engine.stop();
  }, [engine]);

  const handleInput = (input: Readonly<CarInput>) => engine.setInput(LOCAL_PLAYER, input);
  const controls = {
    start: () => engine.startRace(),
    restart: () => {
      engine.resetRace();
      engine.startRace();
    },
  };
  const exitToMenu = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <View style={styles.root}>
      <GameView3D
        engine={engine}
        renderer={renderer}
        viewOptions={race.viewOptions}
        renderScale={race.renderScale}
      />
      <TouchControls
        onInputChange={handleInput}
        tilt={{ enabled: settings.tiltSteering, sensitivity: settings.tiltSensitivity }}
      />
      <RaceHud
        engine={engine}
        carId={LOCAL_PLAYER}
        carColors={carColors}
        snapshot={renderer.snapshot}
        controls={controls}
        onExit={exitToMenu}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "black" },
});
