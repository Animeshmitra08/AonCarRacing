import type { IPv4Interface } from "../../modules/local-network";

import { parseIPv4 } from "./roomCode";

/** Mobile data, VPNs and other interfaces other phones can't reach over local Wi-Fi. */
const EXCLUDED_INTERFACE = /^(rmnet|ccmni|pdp|v4-|clat|tun|ppp|ipsec|utun|dummy|lo|awdl|llw|ifb|sit|ip6)/i;
/** Interfaces that serve a hotspot (Android `ap0`/`swlan0`/`softap0`/`wlan1`, iOS `bridge100`). */
const HOTSPOT_INTERFACE = /^(ap\d|swlan|softap|wlan[1-9]|bridge)/i;
const WIFI_INTERFACE = /^(wlan0|en0)$/i;

function isPrivate([a, b]: number[]): boolean {
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function rank(iface: IPv4Interface): number {
  if (HOTSPOT_INTERFACE.test(iface.name)) return 0;
  if (WIFI_INTERFACE.test(iface.name)) return 1;
  return 2;
}

/**
 * Addresses other phones could use to reach this one, best first. A phone running a
 * hotspot is usually the hub everyone joins, so its hotspot address wins.
 */
export function selectHostAddresses(interfaces: readonly IPv4Interface[]): string[] {
  const candidates = interfaces.filter((iface) => {
    const octets = parseIPv4(iface.address);
    return octets !== null && isPrivate(octets) && !EXCLUDED_INTERFACE.test(iface.name);
  });
  candidates.sort((a, b) => rank(a) - rank(b));
  return [...new Set(candidates.map((iface) => iface.address))];
}
