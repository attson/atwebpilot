import { z } from "zod";

export const ErrorCodes = [
  // ProtocolError (request itself is broken; not retryable)
  "SessionNotFound",
  "SessionExpired",
  "InvalidArgs",
  "PermissionDenied",
  "ToolHashMismatch",
  "ProtocolVersionMismatch",
  "ReplayDetected",
  // WorkerError (browser-side failure; often retryable)
  "WorkerDisconnected",
  "TabClosed",
  "NavigationLost",
  "PageScriptError",
  // CoordinatorError (internal)
  "WorkerBusy",
  "QueueFull",
  "InternalError",
  // Quota
  "SessionExhausted",
  "DangerousQuotaExceeded"
] as const;

export type ErrorCode = (typeof ErrorCodes)[number];

export const ErrorBodySchema = z.object({
  code: z.enum(ErrorCodes),
  message: z.string(),
  retryable: z.boolean(),
  retry_after_ms: z.number().int().nonnegative().optional(),
  audit_id: z.string().optional(),
  /** machine-readable extra context, e.g. {denied_capability: "submit:form"} */
  hints: z.record(z.unknown()).optional()
});

export type ErrorBody = z.infer<typeof ErrorBodySchema>;
