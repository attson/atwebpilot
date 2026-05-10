import { useEffect, useState } from "react";
import { useClosedSessionsPruner } from "./chat/closed-sessions-pruner";
import { installTabTracker } from "./chat/tab-tracker";
import { ClosedSessionsBanner } from "./components/closed-sessions-banner";
import { TabInfoBar } from "./components/tab-info-bar";
import { ChatPage } from "./pages/chat-page";
import { RunPage } from "./pages/run-page";
import { SettingsPage } from "./pages/settings-page";
import { ToolDetailPage } from "./pages/tool-detail-page";
import { ToolsPage } from "./pages/tools-page";

type Route =
  | { name: "chat"; initialPrompt?: string; initialContext?: string }
  | { name: "run" }
  | { name: "tools" }
  | { name: "tool"; id: string; autoRun?: boolean }
  | { name: "settings" };

export function App() {
  const [route, setRoute] = useState<Route>({ name: "chat" });

  useEffect(() => {
    const off = installTabTracker();
    return () => off();
  }, []);
  useClosedSessionsPruner();

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
      </nav>
      {route.name === "chat" && (
        <>
          <ClosedSessionsBanner />
          <TabInfoBar />
        </>
      )}
      <main className="flex-1 overflow-hidden">
        {route.name === "chat" && (
          <ChatPage
            key={(route.initialPrompt ?? "") + (route.initialContext ?? "")}
            initialPrompt={route.initialPrompt}
            initialContext={route.initialContext}
            onOpenTool={openTool}
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
          />
        )}
        {route.name === "settings" && <SettingsPage />}
      </main>
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
