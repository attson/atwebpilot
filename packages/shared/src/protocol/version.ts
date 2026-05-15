/** WS protocol semver-like integer; bump when wire-incompatible changes happen. */
export const PROTOCOL_VERSION = 1;

/** Default heartbeat interval (ms). Worker pings every N; coordinator pongs. */
export const HEARTBEAT_INTERVAL_MS = 20_000;

/** Session goes "expired" after this many ms with no tool calls. */
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** A disconnected session can be reclaimed by the same AI client within this window. */
export const ORPHAN_RECOVERY_MS = 5 * 60 * 1000;

/** Nonce replay-protection window: coordinator caches nonces seen within this many ms. */
export const NONCE_REPLAY_WINDOW_MS = 5 * 60 * 1000;
