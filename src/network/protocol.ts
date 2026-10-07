import { MAX_PLAYERS } from "@/game/constants/RaceConstants";
import type { CarInput } from "@/game/state/CarInput";
import type { GameEvent } from "@/game/state/GameEvents";
import { RacePhase, type RaceState } from "@/game/state/RaceState";
import { sanitizeCarStyle, type CarStyle } from "@/rendering/carStyle";

import { MAX_NAME_LENGTH } from "./constants";

export type PlayerId = string;

export interface LobbyPlayer {
  id: PlayerId;
  name: string;
  colorIndex: number;
  /** Accent/rims/calipers, so every phone draws everyone's customised car. */
  style: CarStyle;
  isHost: boolean;
  connected: boolean;
}

export interface LobbyInfo {
  trackId: string;
  laps: number;
  players: LobbyPlayer[];
  inRace: boolean;
}

/** Grid order is the order of `players`. */
export interface RaceStartInfo {
  trackId: string;
  laps: number;
  players: { id: PlayerId; name: string; colorIndex: number; style: CarStyle }[];
}

/** One tick of input: [seq, throttle, steering, brake 0|1, boost 0|1]. Compact for the wire. */
export type InputFrame = [number, number, number, number, number];

/**
 * Per-car snapshot fields, flattened into `cars`. Velocity is Matter's native
 * unit (world units per fixed step) so it can be applied directly.
 */
export const CAR_STATE_STRIDE = 9;
export const CS_X = 0;
export const CS_Y = 1;
export const CS_ANGLE = 2;
export const CS_VX = 3;
export const CS_VY = 4;
export const CS_STEER = 5;
export const CS_FORWARD_SPEED = 6;
export const CS_BOOST_ENERGY = 7;
export const CS_BOOSTING = 8;

export type ClientMessage =
  | { type: "hello"; protocol: number; name: string; colorIndex: number; style: CarStyle }
  | { type: "input"; inputs: InputFrame[] };

export type HostMessage =
  | { type: "welcome"; playerId: PlayerId; lobby: LobbyInfo }
  | { type: "rejected"; reason: string }
  | { type: "lobby"; lobby: LobbyInfo }
  | { type: "raceStart"; race: RaceStartInfo }
  | { type: "snapshot"; tick: number; cars: number[]; acks: Record<PlayerId, number>; race: RaceState }
  | { type: "event"; event: GameEvent; race: RaceState }
  | { type: "roomClosed"; reason: string };

export function encodeMessage(message: ClientMessage | HostMessage): string {
  return JSON.stringify(message);
}

export function inputToFrame(seq: number, input: Readonly<CarInput>): InputFrame {
  return [seq, input.throttle, input.steering, input.brake ? 1 : 0, input.boost ? 1 : 0];
}

export function frameToInput(frame: InputFrame, out: CarInput): CarInput {
  out.throttle = frame[1];
  out.steering = frame[2];
  out.brake = frame[3] === 1;
  out.boost = frame[4] === 1;
  return out;
}

export function sanitizeName(name: string, fallback: string): string {
  const trimmed = name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : fallback;
}

// ---- Parsing: everything off the wire is untrusted ----

type UnknownRecord = Record<string, unknown>;

function parseJson(text: string): UnknownRecord | null {
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInputFrame(value: unknown): value is InputFrame {
  return Array.isArray(value) && value.length === 5 && value.every(isFiniteNumber);
}

const MAX_FRAMES_PER_MESSAGE = 32;

export function parseClientMessage(text: string): ClientMessage | null {
  const msg = parseJson(text);
  if (!msg) return null;
  switch (msg.type) {
    case "hello":
      if (!isFiniteNumber(msg.protocol) || typeof msg.name !== "string" || !isFiniteNumber(msg.colorIndex)) return null;
      return {
        type: "hello",
        protocol: msg.protocol,
        name: msg.name,
        colorIndex: Math.floor(msg.colorIndex),
        style: sanitizeCarStyle(msg.style),
      };
    case "input":
      if (!Array.isArray(msg.inputs) || msg.inputs.length > MAX_FRAMES_PER_MESSAGE || !msg.inputs.every(isInputFrame)) {
        return null;
      }
      return { type: "input", inputs: msg.inputs };
    default:
      return null;
  }
}

const RACE_PHASES = new Set<unknown>(Object.values(RacePhase));

function isRaceState(value: unknown): value is RaceState {
  return (
    isRecord(value) &&
    RACE_PHASES.has(value.phase) &&
    isFiniteNumber(value.phaseStartTick) &&
    isFiniteNumber(value.raceStartTick) &&
    Array.isArray(value.racers) &&
    Array.isArray(value.finishOrder)
  );
}

function isLobbyInfo(value: unknown): value is LobbyInfo {
  return (
    isRecord(value) &&
    typeof value.trackId === "string" &&
    isFiniteNumber(value.laps) &&
    Array.isArray(value.players) &&
    value.players.length <= MAX_PLAYERS
  );
}

function isRaceStartInfo(value: unknown): value is RaceStartInfo {
  return (
    isRecord(value) &&
    typeof value.trackId === "string" &&
    isFiniteNumber(value.laps) &&
    Array.isArray(value.players) &&
    value.players.length > 0 &&
    value.players.length <= MAX_PLAYERS
  );
}

/** Light validation: the host is the authority, but a malformed message must not crash a client. */
export function parseHostMessage(text: string): HostMessage | null {
  const msg = parseJson(text);
  if (!msg) return null;
  switch (msg.type) {
    case "welcome":
      return typeof msg.playerId === "string" && isLobbyInfo(msg.lobby)
        ? { type: "welcome", playerId: msg.playerId, lobby: msg.lobby }
        : null;
    case "rejected":
    case "roomClosed":
      return typeof msg.reason === "string" ? { type: msg.type, reason: msg.reason } : null;
    case "lobby":
      return isLobbyInfo(msg.lobby) ? { type: "lobby", lobby: msg.lobby } : null;
    case "raceStart":
      return isRaceStartInfo(msg.race) ? { type: "raceStart", race: msg.race } : null;
    case "snapshot":
      return isFiniteNumber(msg.tick) &&
        Array.isArray(msg.cars) &&
        msg.cars.every(isFiniteNumber) &&
        isRecord(msg.acks) &&
        isRaceState(msg.race)
        ? { type: "snapshot", tick: msg.tick, cars: msg.cars, acks: msg.acks as Record<PlayerId, number>, race: msg.race }
        : null;
    case "event":
      return isRecord(msg.event) && typeof msg.event.type === "string" && isRaceState(msg.race)
        ? { type: "event", event: msg.event as GameEvent, race: msg.race }
        : null;
    default:
      return null;
  }
}
