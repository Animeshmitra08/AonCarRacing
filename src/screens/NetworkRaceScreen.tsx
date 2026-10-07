import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { TouchControls } from "@/controls/TouchControls";
import type { GameEngine } from "@/game/engine/GameEngine";
import type { RaceSimulation } from "@/game/engine/RaceSimulation";
import type { CarInput } from "@/game/state/CarInput";
import { RaceHud, type RaceControls } from "@/hud/RaceHud";
import { useLobby, useMultiplayer } from "@/multiplayer/MultiplayerContext";
import { useHardwareBack } from "@/multiplayer/useHardwareBack";
import { NoRoom } from "@/multiplayer/NoRoom";
import type { ClientRace } from "@/network/client/ClientRace";
import type { ClientSession } from "@/network/client/ClientSession";
import { HOST_PLAYER_ID, type HostSession } from "@/network/host/HostSession";
import type { PlayerId } from "@/network/protocol";
import { DEFAULT_CAR_STYLE, resolveCarLook } from "@/rendering/carStyle";
import { GameView3D } from "@/rendering/GameView3D";
import { CAR_COLORS, GRAPHICS_PRESETS } from "@/rendering/RenderConstants";
import { useGameRenderer } from "@/rendering/useGameRenderer";
import { useGameSettings } from "@/settings/GameSettings";

/** Host drives the authoritative engine; clients drive their predicted replica. Same view for both. */
export function NetworkRaceScreen() {
  const { session } = useMultiplayer();
  if (session?.role === "host" && session.raceEngine) {
    return <HostRace session={session} engine={session.raceEngine} />;
  }
  if (session?.role === "client" && session.race) {
    return <ClientRaceScreen session={session} race={session.race} />;
  }
  return <NoRoom />;
}

function HostRace({ session, engine }: { session: HostSession; engine: GameEngine }) {
  useEffect(() => {
    engine.start();
    engine.startRace();
    return () => engine.stop();
  }, [engine]);

  return (
    <NetworkRaceView
      session={session}
      simulation={engine}
      localId={HOST_PLAYER_ID}
      onInput={(input) => engine.setInput(HOST_PLAYER_ID, input)}
      controls={{ start: () => engine.startRace(), restart: () => session.restartRace() }}
    />
  );
}

function ClientRaceScreen({ session, race }: { session: ClientSession; race: ClientRace }) {
  const { localPlayerId } = useLobby(session);
  useEffect(() => {
    race.start();
    return () => race.stop();
  }, [race]);

  if (!localPlayerId) return <NoRoom />;
  return (
    <NetworkRaceView
      session={session}
      simulation={race}
      localId={localPlayerId}
      onInput={(input) => race.setLocalInput(input)}
      controls={null}
    />
  );
}

interface NetworkRaceViewProps {
  session: HostSession | ClientSession;
  simulation: RaceSimulation;
  localId: PlayerId;
  onInput: (input: Readonly<CarInput>) => void;
  controls: RaceControls | null;
}

function NetworkRaceView({ session, simulation, localId, onInput, controls }: NetworkRaceViewProps) {
  const { settings } = useGameSettings();
  const { setSession } = useMultiplayer();
  const lobby = useLobby(session);
  const renderer = useGameRenderer(simulation, localId);
  // Per-player view settings, fixed for the race.
  const [view] = useState(() => ({
    viewOptions: { cameraMode: settings.cameraMode },
    renderScale: GRAPHICS_PRESETS[settings.graphicsQuality].renderScale,
  }));

  const players = simulation.state.cars.map((car) => lobby.players.find((p) => p.id === car.id));
  const carColors = simulation.state.cars.map(
    (car, i) => CAR_COLORS[(players[i]?.colorIndex ?? car.slot) % CAR_COLORS.length],
  );
  const carLooks = simulation.state.cars.map((car, i) =>
    resolveCarLook(players[i]?.colorIndex ?? car.slot, players[i]?.style ?? DEFAULT_CAR_STYLE),
  );

  const { status, closeReason } = lobby;
  useEffect(() => {
    if (status === "closed" && session.role === "client") {
      Alert.alert("Race ended", closeReason ?? "The room was closed.");
      router.dismissTo("/");
    }
  }, [status, closeReason, session]);

  const leave = () => {
    router.dismissTo("/");
    setSession(null);
  };
  const exit = () => {
    if (session.role !== "host") return leave();
    Alert.alert("End the race?", "Leaving closes the room for everyone.", [
      { text: "Stay", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: leave },
    ]);
  };
  useHardwareBack(exit);

  return (
    <View style={styles.root}>
      <GameView3D
        engine={simulation}
        renderer={renderer}
        viewOptions={{ ...view.viewOptions, carLooks }}
        renderScale={view.renderScale}
      />
      <TouchControls
        onInputChange={onInput}
        tilt={{ enabled: settings.tiltSteering, sensitivity: settings.tiltSensitivity }}
      />
      <RaceHud
        engine={simulation}
        carId={localId}
        carColors={carColors}
        snapshot={renderer.snapshot}
        controls={controls}
        onExit={exit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "black" },
});
