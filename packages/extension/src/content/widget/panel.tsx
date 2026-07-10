import { useCallback, useEffect, useState } from "react";
import { X, Minus, ExternalLink } from "lucide-react";
import { ChatView } from "@/sidepanel/components/chat-view";
import { EmptySuggestions } from "@/sidepanel/chat/empty-suggestions";
import { InputBox } from "@/sidepanel/input/input-box";
import {
  useSession,
  appendUserMessage,
  ensureSession,
  setCurrentTab,
} from "@/sidepanel/chat/session-store";
import {
  getApproverForTab,
  broadcastApprovalDecision,
  type Decision,
} from "@/sidepanel/chat/approval";
import { rpc } from "@/sidepanel/rpc";
import { getPanelSize } from "./per-site";
import { getWidgetTabInfo } from "./tab-info";

type Props = {
  onClose: () => void;
  onMinimize: () => void;
};

export function Panel({ onClose, onMinimize }: Props) {
  const [size, setSize] = useState({ w: 320, h: 480 });
  const [tabId, setTabId] = useState<number | null>(null);
  const [input, setInput] = useState("");

  const session = useSession();

  useEffect(() => {
    getPanelSize().then(setSize);
    // Widget runs in a content script — cannot use `chrome.tabs.query`. Ask BG.
    getWidgetTabInfo()
      .then((info) => {
        setTabId(info.tabId);
        setCurrentTab(info.tabId);
        ensureSession(info.tabId, info.url);
      })
      .catch((e) => {
        console.warn("[atwebpilot-widget] tabId lookup failed:", e);
      });
  }, []);

  const isBusy =
    session.status === "streaming" ||
    session.status === "awaiting" ||
    session.status === "running";

  async function handleSubmit() {
    if (!tabId || !input.trim() || isBusy) return;
    const text = input.trim();
    appendUserMessage(tabId, text);
    setInput("");
    try {
      const { runFromInput } = await import("./run-widget-session");
      await runFromInput(tabId, text);
    } catch {
      // Task 12 will implement the full run loop
    }
  }

  async function handleOpenSidepanel() {
    if (!tabId) return;
    await rpc.widgetOpenSidepanel({ tabId }).catch(() => {});
  }

  const handleApprove = useCallback(
    (
      id: string,
      decisionKind: "run" | "run-and-always-allow" | "skip" | "deny",
      toolName?: string
    ) => {
      if (!tabId) return;
      const decision: Decision =
        decisionKind === "run-and-always-allow" && toolName
          ? { kind: "run-and-always-allow", toolName }
          : ({ kind: decisionKind } as Decision);
      // Resolve locally (handles the case where widget holds the pending promise)
      getApproverForTab(tabId).resolve(id, decision);
      // Broadcast to sidepanel context in case IT holds the pending promise
      broadcastApprovalDecision(tabId, id, decision);
    },
    [tabId]
  );

  return (
    <div
      style={{
        position: "fixed",
        right: 72,
        bottom: 16,
        width: size.w,
        height: size.h,
        zIndex: 2147483645,
      }}
      className="bg-zinc-900 text-zinc-100 rounded-lg border border-zinc-700 shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <header className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 text-xs shrink-0">
        <b className="flex-1 select-none">⚡ AtWebPilot</b>
        <button
          className="p-1 hover:bg-zinc-800 rounded"
          title="打开扩展面板"
          onClick={handleOpenSidepanel}
        >
          <ExternalLink size={14} />
        </button>
        <button
          className="p-1 hover:bg-zinc-800 rounded"
          title="最小化"
          onClick={onMinimize}
        >
          <Minus size={14} />
        </button>
        <button
          className="p-1 hover:bg-zinc-800 rounded"
          title="关闭"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-auto min-h-0">
        {session.messages.length === 0 && !isBusy ? (
          <div className="p-3 text-xs text-zinc-400">
            <EmptySuggestions
              matchedTools={[]}
              onRun={() => {}}
              onDetail={() => {}}
              presets={[]}
            />
          </div>
        ) : (
          <ChatView onApprove={handleApprove} />
        )}
      </div>

      {/* Footer: token usage */}
      <footer className="px-2 py-1 text-[10px] text-zinc-500 border-t border-zinc-800 flex justify-between shrink-0">
        <span>
          {session.tokenUsage.input}in / {session.tokenUsage.output}out
        </span>
        <span>
          round {session.roundCount} / 20
        </span>
      </footer>

      {/* Input */}
      <div className="border-t border-zinc-800 p-2 shrink-0">
        <InputBox
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={isBusy}
          placeholder="告诉 AI 你要做什么…"
        />
      </div>
    </div>
  );
}
