import type { Json } from "@atwebpilot/shared/types";

type Args = { ms?: number; selector?: string; timeoutMs?: number };

export async function waitFor(args: Json): Promise<Json> {
  const { ms, selector, timeoutMs = 5000 } = (args ?? {}) as Args;

  if (typeof ms === "number" && !selector) {
    await sleep(ms);
    return { reason: "ms" };
  }

  if (selector) {
    if (document.querySelector(selector)) return { reason: "selector" };
    return new Promise((resolve) => {
      const obs = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          obs.disconnect();
          clearTimeout(timer);
          resolve({ reason: "selector" });
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      const timer = setTimeout(() => {
        obs.disconnect();
        resolve({ reason: "timeout" });
      }, timeoutMs);
    });
  }

  return { reason: "noop" };
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
