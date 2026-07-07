import type { HealContext } from "./self-heal";

const MSG_TYPE = "selfheal.request";
const RESP_TYPE = "selfheal.response";

let counter = 0;

/** Send heal request to sidepanel; wait up to 30s (self-heal is one-shot LLM). */
export async function requestSidepanelLlm(
  ctx: HealContext,
  maxOutputTokens: number
): Promise<{ patchedSteps: unknown; usage: { in: number; out: number } }> {
  const requestId = `sh_${++counter}_${Date.now()}`;
  const req = { type: MSG_TYPE, requestId, ctx, maxOutputTokens };

  const responsePromise = new Promise<{
    patchedSteps: unknown;
    usage: { in: number; out: number };
  }>((resolve, reject) => {
    const listener = (msg: any) => {
      if (msg?.type !== RESP_TYPE || msg.requestId !== requestId) return;
      chrome.runtime.onMessage.removeListener(listener);
      if (msg.ok) resolve({ patchedSteps: msg.patchedSteps, usage: msg.usage });
      else reject(new Error(msg.error));
    };
    chrome.runtime.onMessage.addListener(listener);
    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      reject(new Error("no_sidepanel"));
    }, 30_000);
  });

  try {
    await chrome.runtime.sendMessage(req);
  } catch {
    throw new Error("no_sidepanel");
  }
  return responsePromise;
}
