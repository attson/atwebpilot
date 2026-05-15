import {
  appendSystemNote,
  closeTab,
  ensureSession,
  getSessionFor,
  setCurrentTab,
  setUrl
} from "./session-store";
import { disposeApproverForTab } from "./approval";

export function installTabTracker(): () => void {
  const onAct = ({ tabId }: { tabId: number }) => {
    setCurrentTab(tabId);
    chrome.tabs
      .get(tabId)
      .then((tab) => {
        ensureSession(tabId, tab.url ?? "");
      })
      .catch(() => {
        ensureSession(tabId, "");
      });
  };

  const onUpd = (tabId: number, change: chrome.tabs.TabChangeInfo) => {
    if (!change.url) return;
    setUrl(tabId, change.url);
    if (getSessionFor(tabId).messages.length > 0) {
      appendSystemNote(tabId, `[页面跳转] 新 URL: ${change.url}`);
    }
  };

  const onRem = (tabId: number) => {
    closeTab(tabId);
    disposeApproverForTab(tabId);
  };

  chrome.tabs.onActivated.addListener(onAct);
  chrome.tabs.onUpdated.addListener(onUpd);
  chrome.tabs.onRemoved.addListener(onRem);

  return () => {
    chrome.tabs.onActivated.removeListener(onAct);
    chrome.tabs.onUpdated.removeListener(onUpd);
    chrome.tabs.onRemoved.removeListener(onRem);
  };
}
