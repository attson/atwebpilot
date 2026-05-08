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
