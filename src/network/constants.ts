/** Bump when message shapes change; mismatched peers are rejected. */
export const PROTOCOL_VERSION = 3;

/** Fixed TCP port for rooms, so a room code only needs to encode the host's address. */
export const ROOM_PORT = 47800;

/** Host → clients state broadcast every N ticks (3 → 20 Hz at 60 Hz simulation). */
export const SNAPSHOT_INTERVAL_TICKS = 3;
/** Clients batch their per-tick inputs and send every N ticks. */
export const INPUT_SEND_INTERVAL_TICKS = 2;
/** Remote cars are drawn this far in the past so there are two snapshots to interpolate between. */
export const INTERPOLATION_DELAY_TICKS = SNAPSHOT_INTERVAL_TICKS * 2;
export const SNAPSHOT_BUFFER_SIZE = 32;

/** Host-side cap per client; older inputs are dropped so latency can't build up. */
export const MAX_QUEUED_INPUTS = 8;
/** Client-side cap on unacknowledged inputs kept for replay (2 s). */
export const MAX_PENDING_INPUTS = 120;

/** How fast a reconciliation correction is blended out of the rendered pose (per second). */
export const CORRECTION_SMOOTHING_RATE = 12;
/** Corrections larger than this (world units) are applied instantly, e.g. after a race reset. */
export const CORRECTION_SNAP_DISTANCE = 120;

export const CONNECT_TIMEOUT_MS = 5000;
export const MAX_NAME_LENGTH = 16;
export const MAX_MESSAGE_BYTES = 64 * 1024;
export const MAX_HANDSHAKE_BYTES = 8 * 1024;
