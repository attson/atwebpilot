/**
 * External replay receiver. Listens for window.postMessage from the host page;
 * any message tagged `{source: "atwebpilot-replay", payload}` is forwarded to
 * the BG, which validates and stages it in chrome.storage.local.
 *
 * The sidepanel hook `useExternalReplay` consumes the staged value and shows
 * a review modal — never auto-executed.
 */

window.addEventListener("message", (event) => {
  const data = event.data as unknown;
  if (!data || typeof data !== "object") return;
  const m = data as { source?: string; payload?: unknown };
  if (m.source !== "atwebpilot-replay") return;
  void chrome.runtime
    .sendMessage({
      type: "atwebpilot.externalReplay",
      payload: m.payload,
      sourceUrl: location.href,
    })
    .catch(() => undefined);
});
