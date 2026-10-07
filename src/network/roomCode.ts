/**
 * Room codes encode the host's full IPv4 address as 7 Crockford base-32 characters.
 * Joiners don't need to know their own address, which matters when the joining phone
 * is the one running the hotspot (Android reports its Wi-Fi address as 0.0.0.0 then).
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const ROOM_CODE_LENGTH = 7;
const BASE = ALPHABET.length;
/** Crockford decoding: commonly mistyped letters map to the characters they look like. */
const ALIASES: Record<string, string> = { O: "0", I: "1", L: "1", U: "V" };
const DISPLAY_SPLIT = 3;

export function parseIPv4(ip: string): number[] | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return octets.every((o) => o >= 0 && o <= 255) ? octets : null;
}

export function roomCodeFromIp(ip: string): string | null {
  const octets = parseIPv4(ip);
  if (!octets || octets.every((o) => o === 0)) return null;
  let value = ((octets[0] * 256 + octets[1]) * 256 + octets[2]) * 256 + octets[3];
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code = ALPHABET[value % BASE] + code;
    value = Math.floor(value / BASE);
  }
  return code;
}

/** "009D4K2" → "009-D4K2" for display. Typed codes may include or omit the dash. */
export function formatRoomCode(code: string): string {
  return `${code.slice(0, DISPLAY_SPLIT)}-${code.slice(DISPLAY_SPLIT)}`;
}

export type ResolveResult = { ok: true; address: string } | { ok: false; error: string };

/** Turns what the player typed (a room code or a full IP address) into the host's address. */
export function resolveRoomAddress(input: string): ResolveResult {
  const typed = input.trim().toUpperCase();
  if (typed.includes(".")) {
    return parseIPv4(typed) ? { ok: true, address: typed } : { ok: false, error: "That IP address isn't valid." };
  }

  const compact = typed.replace(/[\s-]/g, "");
  if (compact.length !== ROOM_CODE_LENGTH) {
    return { ok: false, error: `Room codes have ${ROOM_CODE_LENGTH} characters.` };
  }
  let value = 0;
  for (const raw of compact) {
    const digit = ALPHABET.indexOf(ALIASES[raw] ?? raw);
    if (digit < 0) return { ok: false, error: "That room code isn't valid." };
    value = value * BASE + digit;
  }
  if (value > 0xffffffff) return { ok: false, error: "That room code isn't valid." };
  const octets = [24, 16, 8, 0].map((shift) => Math.floor(value / 2 ** shift) % 256);
  return { ok: true, address: octets.join(".") };
}
