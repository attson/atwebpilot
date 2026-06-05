import { useEffect, useState } from "react";
import { validateAttachedTabs, useStore } from "./chat/session-store";
import { installTabTracker } from "./chat/tab-tracker";
import { installAutoPersist } from "./chat/persistence/auto-persist";
import { hydrateOnBoot, type HydrateResult } from "./chat/persistence/hydrate";
import { TabInfoBar } from "./components/tab-info-bar";
import { UrlRecoveryBanner } from "./components/url-recovery-banner";
import { SessionHistoryDrawer } from "./components/session-history-drawer";
import { mountSidepanelStateBridge } from "@/sidepanel/coordinator-state-bridge";
import { ChatPage } from "./pages/chat-page";
import { CoordinatorSettingsPage } from "./pages/coordinator-settings-page";
import { RunPage } from "./pages/run-page";
import { SettingsPage } from "./pages/settings-page";
import { ToolDetailPage } from "./pages/tool-detail-page";
import { ToolsPage } from "./pages/tools-page";

type Route =
  | {
      name: "chat";
      initialPrompt?: string;
      initialContext?: string;
      autoSend?: boolean;
      sourceTool?: { id: string; name: string; description: string; urlPatterns: string[] };
    }
  | { name: "run" }
  | { name: "tools" }
  | { name: "tool"; id: string; autoRun?: boolean }
  | { name: "settings" }
  | { name: "coordinator" };

export function App() {
  const [route, setRoute] = useState<Route>({ name: "chat" });
  const [hydrate, setHydrate] = useState<HydrateResult | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const currentUrl = useStore((s) =>
    s.currentTabId != null ? s.sessionsByTab[s.currentTabId]?.url ?? "" : ""
  );

  useEffect(() => {
    const off = installTabTracker();
    return () => off();
  }, []);

  useEffect(() => mountSidepanelStateBridge(), []);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;

    async function tryHydrate(): Promise<boolean> {
      const state = useStore.getState();
      const tabId = state.currentTabId;
      if (tabId == null) return false;
      const url = state.sessionsByTab[tabId]?.url ?? "";
      if (!url) return false;
      const result = await hydrateOnBoot(tabId, url);
      if (!cancelled) setHydrate(result);
      return true;
    }

    void tryHydrate().then((ok) => {
      if (ok || cancelled) return;
      unsub = useStore.subscribe((s) => {
        if (s.currentTabId != null && s.sessionsByTab[s.currentTabId]?.url) {
          unsub?.();
          unsub = null;
          void tryHydrate();
        }
      });
    });

    const offPersist = installAutoPersist();
    return () => {
      cancelled = true;
      unsub?.();
      offPersist();
    };
  }, []);
  useEffect(() => {
    void (async () => {
      try {
        const tabs = await chrome.tabs.query({});
        const known = new Set(tabs.map((t) => t.id).filter((id): id is number => id != null));
        validateAttachedTabs(known);
      } catch {
        // chrome.tabs not available in some test contexts
      }
    })();
  }, []);
  function fixWithAi(opts: { initialPrompt: string; initialContext: string }) {
    setRoute({
      name: "chat",
      initialPrompt: opts.initialPrompt,
      initialContext: opts.initialContext
    });
  }

  function openTool(id: string, autoRun: boolean) {
    setRoute({ name: "tool", id, autoRun });
  }

  function runPromptTool(tool: {
    id: string;
    name: string;
    description: string;
    prompt: string;
    urlPatterns: string[];
  }) {
    setRoute({
      name: "chat",
      initialPrompt: tool.prompt,
      initialContext: [
        "# 保存的提示词工具",
        `名称：${tool.name}`,
        `描述：${tool.description}`,
        `URL 模式：${tool.urlPatterns.join(", ")}`,
        "",
        "请把接下来用户消息视为一个已保存工具的任务说明。基于当前页面重新执行，不要机械复述旧对话；如果页面结构变化，请先读取页面再判断。"
      ].join("\n"),
      autoSend: true,
      sourceTool: {
        id: tool.id,
        name: tool.name,
        description: tool.description,
        urlPatterns: tool.urlPatterns
      }
    });
  }

  return (
    <div className="h-full flex flex-col">
      <nav className="flex gap-1 p-2 border-b border-zinc-800 text-xs">
        <NavBtn active={route.name === "chat"} onClick={() => setRoute({ name: "chat" })}>
          对话
        </NavBtn>
        <NavBtn
          active={route.name === "tools" || route.name === "tool"}
          onClick={() => setRoute({ name: "tools" })}
        >
          工具库
        </NavBtn>
        <NavBtn active={route.name === "run"} onClick={() => setRoute({ name: "run" })}>
          DEV: JSON
        </NavBtn>
        <NavBtn active={route.name === "settings"} onClick={() => setRoute({ name: "settings" })}>
          设置
        </NavBtn>
        <NavBtn
          active={route.name === "coordinator"}
          onClick={() => setRoute({ name: "coordinator" })}
        >
          Coordinator
        </NavBtn>
      </nav>
      {route.name === "chat" && (
        <>
          {hydrate?.kind === "url-candidates" && (
            <UrlRecoveryBanner
              candidates={hydrate.candidates}
              onOpenDrawer={() => setDrawerOpen(true)}
              onDismiss={() => setHydrate({ kind: "empty" })}
            />
          )}
          <TabInfoBar />
        </>
      )}
      <main className="flex-1 overflow-hidden">
        {route.name === "chat" && (
          <ChatPage
            key={(route.initialPrompt ?? "") + (route.initialContext ?? "")}
            initialPrompt={route.initialPrompt}
            initialContext={route.initialContext}
            autoSend={route.autoSend}
            sourceTool={route.sourceTool}
            onOpenTool={openTool}
            onRunPromptTool={runPromptTool}
            onOpenHistory={() => setDrawerOpen(true)}
          />
        )}
        {route.name === "run" && <RunPage />}
        {route.name === "tools" && <ToolsPage onOpen={(id) => setRoute({ name: "tool", id })} />}
        {route.name === "tool" && (
          <ToolDetailPage
            key={`${route.id}-${route.autoRun ? "auto" : "manual"}`}
            id={route.id}
            autoRun={route.autoRun}
            onBack={() => setRoute({ name: "tools" })}
            onFixWithAi={fixWithAi}
            onRunPromptTool={runPromptTool}
          />
        )}
        {route.name === "settings" && <SettingsPage />}
        {route.name === "coordinator" && <CoordinatorSettingsPage />}
      </main>
      <SessionHistoryDrawer
        url={currentUrl}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}

function NavBtn(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      className={
        "px-3 py-1 rounded " +
        (props.active ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200")
      }
    >
      {props.children}
    </button>
  );
}
