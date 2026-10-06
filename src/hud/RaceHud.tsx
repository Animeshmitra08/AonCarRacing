import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { CarId } from "@/game/entities/Car";
import type { GameEngine } from "@/game/engine/GameEngine";
import { RacePhase } from "@/game/state/RaceState";

import { formatTicks } from "./format";
import { LiveReadouts } from "./LiveReadouts";
import { Minimap } from "./Minimap";
import { PopText } from "./PopText";
import { useRaceHud, type RaceHudState } from "./useRaceHud";

const GO_HOLD_MS = 600;
const PANEL_PADDING = 12;
const MENU_HIT_SLOP = 10;

interface RaceHudProps {
  engine: GameEngine;
  carId: CarId;
  /** Index-aligned with `engine.state.cars`. */
  carColors: readonly string[];
  snapshot: SharedValue<number[]>;
  onExit: () => void;
}

export function RaceHud({ engine, carId, carColors, snapshot, onExit }: RaceHudProps) {
  const hud = useRaceHud(engine, carId);
  const insets = useSafeAreaInsets();
  const playerIndex = engine.state.cars.findIndex((car) => car.id === carId);

  const startRace = () => engine.startRace();
  const raceAgain = () => {
    engine.resetRace();
    engine.startRace();
  };

  return (
    <View style={styles.overlay}>
      <View style={[styles.panel, { top: insets.top + PANEL_PADDING, left: insets.left + PANEL_PADDING }]}>
        <Text style={styles.lap}>
          LAP {hud.currentLap}/{hud.laps}
        </Text>
        <LiveReadouts snapshot={snapshot} />
        <Text style={styles.small}>BEST {formatTicks(hud.bestLapTicks)}</Text>
      </View>

      <View style={[styles.minimap, { top: insets.top + PANEL_PADDING, right: insets.right + PANEL_PADDING }]}>
        <Minimap
          track={engine.state.track}
          cars={engine.state.cars}
          carColors={carColors}
          playerIndex={playerIndex}
          snapshot={snapshot}
        />
      </View>

      <Pressable
        onPress={onExit}
        hitSlop={MENU_HIT_SLOP}
        style={({ pressed }) => [styles.menuButton, { top: insets.top + PANEL_PADDING }, pressed && styles.buttonPressed]}
      >
        <Text style={styles.menuButtonText}>✕ MENU</Text>
      </Pressable>

      <View style={styles.center}>
        <PhaseOverlay hud={hud} onStart={startRace} onRaceAgain={raceAgain} onExit={onExit} />
      </View>
    </View>
  );
}

interface PhaseOverlayProps {
  hud: RaceHudState;
  onStart: () => void;
  onRaceAgain: () => void;
  onExit: () => void;
}

function PhaseOverlay({ hud, onStart, onRaceAgain, onExit }: PhaseOverlayProps) {
  switch (hud.phase) {
    case RacePhase.Lobby:
      return <HudButton label="TAP TO START" onPress={onStart} />;
    case RacePhase.Countdown:
      return hud.countdown === null ? null : <PopText key={hud.countdown} text={String(hud.countdown)} />;
    case RacePhase.Racing:
      return <PopText key="go" text="GO!" color="#7CFC00" holdMs={GO_HOLD_MS} />;
    case RacePhase.Finishing:
      return <PopText key="finish" text="FINISH!" />;
    case RacePhase.Results:
      return (
        <View style={styles.results}>
          <Text style={styles.resultsTitle}>{hud.position === null ? "DNF" : `P${hud.position}`}</Text>
          <Text style={styles.resultsLine}>TIME {formatTicks(hud.finishTicks)}</Text>
          <Text style={styles.resultsLine}>BEST LAP {formatTicks(hud.bestLapTicks)}</Text>
          <View style={styles.resultsButtons}>
            <HudButton label="MENU" onPress={onExit} secondary />
            <HudButton label="RACE AGAIN" onPress={onRaceAgain} />
          </View>
        </View>
      );
  }
}

function HudButton({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, pressed && styles.buttonPressed]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, pointerEvents: "box-none" },
  panel: {
    position: "absolute",
    pointerEvents: "none",
    padding: PANEL_PADDING,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    gap: 4,
  },
  minimap: {
    position: "absolute",
    pointerEvents: "none",
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  lap: { color: "white", fontSize: 22, fontWeight: "900" },
  small: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "700" },
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", pointerEvents: "box-none" },
  results: {
    alignItems: "center",
    gap: 8,
    padding: 24,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  resultsTitle: { color: "white", fontSize: 48, fontWeight: "900" },
  resultsLine: { color: "white", fontSize: 18, fontWeight: "700" },
  resultsButtons: { flexDirection: "row", gap: 12 },
  menuButton: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  menuButtonText: { color: "white", fontSize: 13, fontWeight: "900", letterSpacing: 1 },
  buttonSecondary: { backgroundColor: "rgba(255,255,255,0.15)" },
  button: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: "#e63946",
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: "white", fontSize: 18, fontWeight: "900", letterSpacing: 1 },
});
