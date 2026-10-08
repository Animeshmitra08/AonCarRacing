/**
 * Keep each secure-store value under this many bytes: some iOS versions reject
 * values above ~2 KB.
 */
export const MAX_VALUE_BYTES = 1900;

/** Byte length of a string as UTF-8, without TextEncoder (not guaranteed on Hermes). */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}
