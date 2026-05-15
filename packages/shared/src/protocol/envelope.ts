import { z } from "zod";

/**
 * Every WS message carries these envelope fields for transport-level concerns:
 * - nonce: single-use token to detect replay
 * - ts: client clock when the message was constructed (ms since epoch)
 * - protocol_version: PROTOCOL_VERSION at send time; mismatch aborts the connection
 */
export const EnvelopeFields = {
  nonce: z.string().min(1),
  ts: z.number().int().nonnegative(),
  protocol_version: z.number().int().positive()
} as const;

export const EnvelopeSchema = z.object(EnvelopeFields);

export type Envelope = z.infer<typeof EnvelopeSchema>;
