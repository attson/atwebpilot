import { RpcRequest as RpcRequestSchema } from "@webpilot/shared/messages";
import { handleRpc } from "./rpc-handlers";
import { installTabWatcher } from "./tab-watcher";
import { installTabCloseArchiver } from "./tab-close-archiver";
import { CoordinatorClient } from "./coordinator-client";
import { getOrCreateWorkerId, loadConfig, loadToken } from "./coordinator-state";
import { handleExec } from "./coordinator-exec";
import { listTools } from "./storage/tools";
import { CoordinatorChatHost } from "./coordinator-chat";
import { CoordinatorStateBridge } from "./coordinator-state-bridge";

chrome.runtime.onInstalled.addListener(() => {
  console.info("[webpilot] service worker installed");
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id == null) return;
  await chrome.sidePanel.open({ tabId: tab.id });
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((e) => console.error("[webpilot] sidePanel setPanelBehavior", e));

installTabWatcher();
installTabCloseArchiver();

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

// --- Coordinator client (Phase 2) ---
let activeClient: CoordinatorClient | null = null;
let activeStateBridge: CoordinatorStateBridge | null = null;

async function buildSavedToolsMetadata(): Promise<
  Array<{ id: string; version: number; hash: string; url_pattern: string[]; description?: string }>
> {
  const tools = await listTools();
  return tools.map((t) => ({
    id: t.id,
    version: t.versions?.length ?? 1,
    // Phase 2 stub: hash from id. Phase 3 will introduce real content hashing.
    hash: t.id,
    url_pattern: t.urlPatterns,
    description: t.description
  }));
}

export async function startCoordinatorClient(): Promise<void> {
  if (activeClient) return;
  const config = await loadConfig();
  if (!config?.enabled || !config.ws_url) return;
  const token = await loadToken();
  if (!token) {
    console.warn("[webpilot] coordinator enabled but no token saved");
    return;
  }
  const worker_id = await getOrCreateWorkerId();
  const chatHost = new CoordinatorChatHost();
  activeStateBridge = new CoordinatorStateBridge({
    sendRuntimeMessage: (m) => chrome.runtime.sendMessage(m),
    onRuntimeMessage: (fn) => chrome.runtime.onMessage.addListener(fn),
    offRuntimeMessage: (fn) => chrome.runtime.onMessage.removeListener(fn)
  });
  activeClient = new CoordinatorClient({
    ws_url: config.ws_url,
    token,
    worker_id,
    savedToolsProvider: buildSavedToolsMetadata,
    labelsProvider: async () => [],
    onExec: handleExec,
    onChat: (m, send) => chatHost.handle(m, send),
    onReadState: (m, send) => activeStateBridge!.handle(m, send)
  });
  await activeClient.connect();
}

export async function stopCoordinatorClient(): Promise<void> {
  if (activeStateBridge) {
    activeStateBridge.dispose();
    activeStateBridge = null;
  }
  if (!activeClient) return;
  await activeClient.disconnect();
  activeClient = null;
}

void startCoordinatorClient();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const keys = Object.keys(changes);
  if (
    keys.some(
      (k) =>
        k === "webpilot.coordinator.config" || k === "webpilot.coordinator.token"
    )
  ) {
    void (async () => {
      await stopCoordinatorClient();
      await startCoordinatorClient();
    })();
  }
});
