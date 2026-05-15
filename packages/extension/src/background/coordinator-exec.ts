import { PROTOCOL_VERSION, type Exec, type Result, type ErrorBody } from "@webpilot/shared/protocol";
import { runOneStep } from "./rpc-handlers";

function randomNonce(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function makeError(code: ErrorBody["code"], message: string, retryable = false): ErrorBody {
  return { code, message, retryable };
}

function makeResult(req_id: string, ok: boolean, ret?: unknown, error?: ErrorBody): Result {
  return {
    type: "RESULT",
    nonce: randomNonce(),
    ts: Date.now(),
    protocol_version: PROTOCOL_VERSION,
    req_id,
    ok,
    ...(ret !== undefined ? { return: ret } : {}),
    ...(error ? { error } : {})
  };
}

/**
 * Handle a single EXEC message from the coordinator: parse tab id, delegate
 * to runOneStep, and wrap the outcome in a RESULT envelope. Never throws —
 * any error becomes an `ok: false` RESULT.
 */
export async function handleExec(exec: Exec): Promise<Result> {
  const tabId = Number.parseInt(exec.tab_id, 10);
  if (!Number.isFinite(tabId)) {
    return makeResult(exec.req_id, false, undefined, makeError(
      "InvalidArgs",
      `tab_id "${exec.tab_id}" is not a number`
    ));
  }

  try {
    const stepResult = await (runOneStep as unknown as (step: unknown, tabId: number) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>)(exec.step, tabId);
    if (stepResult.ok) {
      return makeResult(exec.req_id, true, stepResult.data);
    }
    return makeResult(exec.req_id, false, undefined, makeError(
      "PageScriptError",
      stepResult.error
    ));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return makeResult(exec.req_id, false, undefined, makeError(
      "InternalError",
      message,
      true
    ));
  }
}
