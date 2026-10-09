import { useMemo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { CarId } from "@/game/entities/Car";
import type { RaceSimulation } from "@/game/engine/RaceSimulation";
import { RacePhase } from "@/game/state/RaceState";
import type { RecordOutcome } from "@/scores/scoreBook";

import { FinisherToast } from "./FinisherToast";
import { FinishSequence } from "./FinishSequence";
import { formatTicks } from "./format";
import { Leaderboard, type RacerInfo } from "./Leaderboard";
import { LiveReadouts } from "./LiveReadouts";
import { Minimap } from "./Minimap";
import { PopText } from "./PopText";
import { useRaceHud, type RaceHudState } from "./useRaceHud";
import { WrongWayIndicator } from "./WrongWayIndicator";

const GO_HOLD_MS = 600;
const PANEL_PADDING = 12;
const MENU_HIT_SLOP = 10;
/** Below the ✕ MENU button. */
const BANNER_OFFSET = 56;

/** Who may start/restart the race. Network clients get `null` and wait for the host. */
export interface RaceControls {
  start(): void;
  restart(): void;
}

interface RaceHudProps {
  engine: RaceSimulation;
  carId: CarId;
  /** Index-aligned with `engine.state.cars`. */
  carColors: readonly string[];
  /** Index-aligned with `engine.state.cars`. */
  racerNames: readonly string[];
  /** Personal bests set by this race (shown on the finish banner). */
  personalBest: RecordOutcome | null;
  snapshot: SharedValue<number[]>;
  controls: RaceControls | null;
  onExit: () => void;
}

export function RaceHud({
  engine,
  carId,
  carColors,
  racerNames,
  personalBest,
  snapshot,
  controls,
  onExit,
}: RaceHudProps) {
  const hud = useRaceHud(engine, carId);
  const insets = useSafeAreaInsets();
  const { cars } = engine.state;
  const playerIndex = cars.findIndex((car) => car.id === carId);
  const racers = useMemo(
    () =>
      new Map<CarId, RacerInfo>(
        cars.map((car, i) => [car.id, { name: racerNames[i] ?? `Racer ${i + 1}`, color: carColors[i] ?? "white" }]),
      ),
    [cars, racerNames, carColors],
  );

  const localFinished = hud.finishTicks !== null && hud.position !== null;
  const bannerTop = insets.top + BANNER_OFFSET;
  const leaderboard = (
    <Leaderboard
      standings={hud.standings}
      racers={racers}
      localCarId={carId}
      laps={hud.laps}
      final={hud.phase === RacePhase.Results}
      footer={<ResultsFooter hud={hud} controls={controls} onExit={onExit} />}
    />
  );

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
        <Minimap track={engine.state.track} cars={cars} carColors={carColors} playerIndex={playerIndex} snapshot={snapshot} />
      </View>

      <Pressable
        onPress={onExit}
        hitSlop={MENU_HIT_SLOP}
        style={({ pressed }) => [styles.menuButton, { top: insets.top + PANEL_PADDING }, pressed && styles.buttonPressed]}
      >
        <Text style={styles.menuButtonText}>✕ MENU</Text>
      </Pressable>

      <WrongWayIndicator snapshot={snapshot} top={bannerTop} />
      {!localFinished && hud.lastFinisher && (
        <FinisherToast
          key={hud.lastFinisher.carId}
          name={racers.get(hud.lastFinisher.carId)?.name ?? "A racer"}
          position={hud.lastFinisher.position}
          top={bannerTop}
        />
      )}

      <View style={styles.center}>
        {localFinished ? (
          <FinishSequence
            ranked={cars.length > 1}
            position={hud.position!}
            totalTicks={hud.finishTicks}
            personalBest={personalBest}
          >
            {leaderboard}
          </FinishSequence>
        ) : (
          <PhaseOverlay hud={hud} controls={controls} leaderboard={leaderboard} />
        )}
      </View>
    </View>
  );
}

interface PhaseOverlayProps {
  hud: RaceHudState;
  controls: RaceControls | null;
  /** Shown at RESULTS if the local player didn't finish. */
  leaderboard: ReactNode;
}

function PhaseOverlay({ hud, controls, leaderboard }: PhaseOverlayProps) {
  switch (hud.phase) {
    case RacePhase.Lobby:
      return controls ? (
        <HudButton label="TAP TO START" onPress={() => controls.start()} />
      ) : (
        <Text style={styles.waiting}>WAITING FOR HOST…</Text>
      );
    case RacePhase.Countdown:
      return hud.countdown === null ? null : <PopText key={hud.countdown} text={String(hud.countdown)} />;
    case RacePhase.Racing:
      return <PopText key="go" text="GO!" color="#7CFC00" holdMs={GO_HOLD_MS} />;
    case RacePhase.Finishing:
      // Someone else finished; the toast says so and this player keeps racing.
      return null;
    case RacePhase.Results:
      return leaderboard;
  }
}

function ResultsFooter({ hud, controls, onExit }: { hud: RaceHudState; controls: RaceControls | null; onExit: () => void }) {
  if (hud.phase !== RacePhase.Results) return <Text style={styles.waitingSmall}>Waiting for the other racers…</Text>;
  return (
    <>
      <HudButton label="MENU" onPress={onExit} secondary />
      {controls ? (
        <HudButton label="RACE AGAIN" onPress={() => controls.restart()} />
      ) : (
        <Text style={styles.waitingSmall}>Waiting for the host…</Text>
      )}
    </>
  );
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
  waiting: { color: "white", fontSize: 16, fontWeight: "800", letterSpacing: 1, marginTop: 8 },
  waitingSmall: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
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
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#e63946",
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: "white", fontSize: 16, fontWeight: "900", letterSpacing: 1 },
});
