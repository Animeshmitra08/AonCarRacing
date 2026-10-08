import LocalNetwork from "../../modules/local-network";

import { ClientSession, describeSocketError } from "@/network/client/ClientSession";
import { ROOM_PORT } from "@/network/constants";
import { selectHostAddresses } from "@/network/addressSelection";
import { HostSession } from "@/network/host/HostSession";
import { resolveRoomAddress } from "@/network/roomCode";
import { createNativeTcpServer } from "@/network/transport/nativeTcpServer";
import type { GameSettings } from "@/settings/GameSettings";

const SELF_TEST_TIMEOUT_MS = 3000;

/** Wires the platform pieces (native TCP server, interface list) into a host session. */
/** `name` is the signed-in player's display name. */
export async function hostRoom(settings: GameSettings, name: string): Promise<HostSession> {
  const session = new HostSession({
    name,
    colorIndex: settings.carColorIndex,
    style: settings.carStyle,
    trackId: settings.trackId,
    laps: settings.laps,
    createTcpServer: createNativeTcpServer,
    getLocalAddresses: () => selectHostAddresses(LocalNetwork.getIPv4Interfaces()),
  });
  try {
    await session.open();
  } catch (e) {
    session.close();
    throw new Error(`Couldn't start a room on this phone${errorDetail(e)}.`);
  }
  try {
    await selfTest(ROOM_PORT);
  } catch (e) {
    session.close();
    throw new Error(`This phone's room server isn't responding${errorDetail(e)}.`);
  }
  return session;
}

export async function joinRoom(code: string, settings: GameSettings, name: string): Promise<ClientSession> {
  const resolved = resolveRoomAddress(code);
  if (!resolved.ok) throw new Error(resolved.error);

  // Android may send traffic over mobile data when the hotspot Wi-Fi has no internet,
  // which can't reach the host. Pin the app to the network that contains the host.
  const bound = await LocalNetwork.bindToNetworkForAddressAsync(resolved.address).catch(() => false);
  const unbind = () => {
    if (bound) LocalNetwork.unbindNetworkAsync().catch(() => {});
  };

  const session = new ClientSession({
    address: resolved.address,
    roomCode: code.trim().toUpperCase(),
    name,
    colorIndex: settings.carColorIndex,
    style: settings.carStyle,
  });
  const unsubscribe = session.subscribe(() => {
    if (session.getLobby().status !== "closed") return;
    unsubscribe();
    unbind();
  });
  await session.connect();
  return session;
}

/** Connects to our own server over loopback to prove it accepts WebSocket connections. */
function selfTest(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    const finish = (error: Error | null) => {
      clearTimeout(timer);
      socket.onopen = socket.onerror = socket.onclose = null;
      socket.close();
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(() => finish(new Error("timed out")), SELF_TEST_TIMEOUT_MS);
    socket.onopen = () => finish(null);
    socket.onerror = (event) => finish(new Error(describeSocketError(event) ?? "connection failed"));
    socket.onclose = (event) => finish(new Error(describeSocketError(event) ?? "connection closed"));
  });
}

function errorDetail(error: unknown): string {
  return error instanceof Error && error.message ? ` (${error.message})` : "";
}
