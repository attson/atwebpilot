import { z } from "zod";
import { EnvelopeFields } from "./envelope";
import { ErrorBodySchema } from "./errors";

const StepSchema = z.object({
  tool: z.string(),
  args: z.unknown()
});

// === C → S messages ===

export const HelloSchema = z.object({
  ...EnvelopeFields,
  type: z.literal("HELLO"),
  worker_id: z.string().min(1),
  fingerprint: z.object({
    ext_hash: z.string(),
    os: z.string(),
    chrome: z.string()
  }),
  capabilities: z.array(z.string()),
  attended: z.boolean(),
  available_tabs: z.array(
    z.object({
      tab_id: z.string(),
      url: z.string(),
      title: z.string().optional()
    })
  ),
  saved_tools: z.array(
    z.object({
      id: z.string(),
      version: z.number().int().nonnegative(),
      hash: z.string(),
      url_pattern: z.array(z.string()),
      description: z.string().optional()
    })
  ),
  labels: z.array(z.string())
});

export const PingSchema = z.object({
  ...EnvelopeFields,
  type: z.literal("PING")
});

export const TabReadySchema = z.object({
  ...EnvelopeFields,
  type: z.literal("TAB_READY"),
  session_id: z.string(),
  tab_id: z.string(),
  current_url: z.string()
});

export const ProgressSchema = z.object({
  ...EnvelopeFields,
  type: z.literal("PROGRESS"),
  req_id: z.string(),
  partial: z.unknown()
});

export const ResultSchema = z.object({
  ...EnvelopeFields,
  type: z.literal("RESULT"),
  req_id: z.string(),
  ok: z.boolean(),
  return: z.unknown().optional(),
  error: ErrorBodySchema.optional()
});

export const SessionEventSchema = z.object({
  ...EnvelopeFields,
  type: z.literal("SESSION_EVENT"),
  session_id: z.string(),
  kind: z.enum(["navigated", "tab_closed", "audit"]),
  payload: z.unknown()
});

export const StateSnapshotSchema = z.object({
  ...EnvelopeFields,
  type: z.literal("STATE_SNAPSHOT"),
  last_session_states: z.array(
    z.object({
      session_id: z.string(),
      tab_id: z.string(),
      state: z.string()
    })
  )
});

// === S → C messages ===

export const WelcomeSchema = z.object({
  ...EnvelopeFields,
  type: z.literal("WELCOME"),
  server_time: z.number(),
  heartbeat_interval_ms: z.number().int().positive(),
  server_pubkey_pin: z.string().optional()
});

export const PongSchema = z.object({
  ...EnvelopeFields,
  type: z.literal("PONG"),
  echo_nonce: z.string()
});

export const OpenTabSchema = z.object({
  ...EnvelopeFields,
  type: z.literal("OPEN_TAB"),
  session_id: z.string(),
  url: z.string(),
  reuse_if_match: z.array(z.string()).optional()
});

export const ExecSchema = z.object({
  ...EnvelopeFields,
  type: z.literal("EXEC"),
  req_id: z.string(),
  session_id: z.string(),
  tab_id: z.string(),
  step: StepSchema
});

export const CloseSessionSchema = z.object({
  ...EnvelopeFields,
  type: z.literal("CLOSE_SESSION"),
  session_id: z.string()
});

// === Discriminated unions ===

export const ClientToServerSchema = z.discriminatedUnion("type", [
  HelloSchema,
  PingSchema,
  TabReadySchema,
  ProgressSchema,
  ResultSchema,
  SessionEventSchema,
  StateSnapshotSchema
]);

export const ServerToClientSchema = z.discriminatedUnion("type", [
  WelcomeSchema,
  PongSchema,
  OpenTabSchema,
  ExecSchema,
  CloseSessionSchema
]);

export const ProtocolMessageSchema = z.union([ClientToServerSchema, ServerToClientSchema]);

export type ClientToServer = z.infer<typeof ClientToServerSchema>;
export type ServerToClient = z.infer<typeof ServerToClientSchema>;
export type ProtocolMessage = z.infer<typeof ProtocolMessageSchema>;

export type Hello = z.infer<typeof HelloSchema>;
export type Welcome = z.infer<typeof WelcomeSchema>;
export type Exec = z.infer<typeof ExecSchema>;
export type Result = z.infer<typeof ResultSchema>;
export type Progress = z.infer<typeof ProgressSchema>;
