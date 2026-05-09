import { RpcRequest as RpcRequestSchema } from "@/shared/messages";
import { handleRpc } from "./rpc-handlers";
import { installTabWatcher } from "./tab-watcher";

chrome.runtime.onInstalled.addListener(() => {
  console.info("[caiji2] service worker installed");
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id == null) return;
  await chrome.sidePanel.open({ tabId: tab.id });
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((e) => console.error("[caiji2] sidePanel setPanelBehavior", e));

installTabWatcher();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const parsed = RpcRequestSchema.safeParse(msg);
  if (!parsed.success) return false;

  let req: unknown = parsed.data;
  if (parsed.data.type === "scripting.injectMain" && sender.tab?.id != null) {
    req = { ...parsed.data, tabId: sender.tab.id };
  }

  handleRpc(req).then(sendResponse);
  return true;
});
