import { useState } from "react";
import type { ChatMessage, LlmExchange } from "@webpilot/shared/types";

type Props = {
  open: boolean;
  exchanges: LlmExchange[];
  onClose: () => void;
};

export function LlmExchangePanel({ open, exchanges, onClose }: Props) {
  if (!open) return null;

  async function copyOne(ex: LlmExchange) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(ex, null, 2));
    } catch {
      // ignore
    }
  }

  function exportAll() {
    const blob = new Blob([JSON.stringify(exchanges, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `llm-exchanges-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="absolute inset-0 z-50 bg-zinc-950 flex flex-col text-xs">
      <div className="flex items-center gap-2 p-2 border-b border-zinc-800">
        <span className="text-zinc-200 font-medium">原始 LLM 交互（{exchanges.length}）</span>
        <button onClick={exportAll} className="px-2 py-0.5 bg-zinc-700 rounded text-[11px]">
          导出全部
        </button>
        <button onClick={onClose} className="ml-auto px-2 py-0.5 bg-zinc-700 rounded text-[11px]">
          关闭
        </button>
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-2">
        {exchanges.length === 0 && <div className="text-zinc-500">暂无交互记录</div>}
        {exchanges.map((ex) => (
          <ExchangeCard key={ex.id} ex={ex} onCopy={() => copyOne(ex)} />
        ))}
      </div>
    </div>
  );
}

function ExchangeCard({ ex, onCopy }: { ex: LlmExchange; onCopy: () => void }) {
  const [open, setOpen] = useState(false);
  const u = ex.response.usage;
  const bad = ex.response.error || ex.response.aborted;
  return (
    <div className={`rounded border ${bad ? "border-amber-700" : "border-zinc-700"} bg-zinc-900`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left p-2 flex items-center gap-2 flex-wrap"
      >
        <span>{open ? "▾" : "▸"}</span>
        <span className="font-medium">#{ex.round}</span>
        <span className="text-zinc-400">{ex.request.model}</span>
        <span className="text-zinc-500">{ex.durationMs}ms</span>
        {u && <span className="text-zinc-500">in {u.input_tokens}/out {u.output_tokens}</span>}
        {ex.response.stopReason && <span className="text-zinc-500">{ex.response.stopReason}</span>}
        {ex.response.aborted && <span className="text-amber-400">aborted</span>}
        {ex.response.error && <span className="text-red-400">error</span>}
      </button>
      {open && (
        <div className="p-2 border-t border-zinc-800 space-y-2">
          <button onClick={onCopy} className="px-2 py-0.5 bg-zinc-700 rounded text-[11px]">
            复制本条
          </button>
          <Section title="Request">
            <Field label="system" value={ex.request.system} />
            <div className="text-zinc-500">
              tools: {ex.request.toolNames.join(", ") || "(none)"} · max_tokens:{" "}
              {ex.request.maxTokens ?? "(默认)"}
              {ex.request.endpoint ? ` · endpoint: ${ex.request.endpoint}` : ""}
            </div>
            <MessageList messages={ex.request.messages} />
          </Section>
          <Section title="Response">
            {ex.response.text && <Field label="text" value={ex.response.text} />}
            {ex.response.toolUses.map((t) => (
              <Field key={t.id} label={`tool_use ${t.name}`} value={JSON.stringify(t.input, null, 2)} />
            ))}
            {ex.response.error && <div className="text-red-400">error: {ex.response.error}</div>}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-zinc-300 font-medium">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-zinc-500">{label}</div>
      <pre className="text-[10px] text-zinc-300 bg-zinc-950 rounded p-1 overflow-auto whitespace-pre-wrap max-h-48">
        {value}
      </pre>
    </div>
  );
}

function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="space-y-1">
      {messages.map((m, i) => (
        <div key={i}>
          <div className="text-zinc-500">[{m.role}]</div>
          <pre className="text-[10px] text-zinc-300 bg-zinc-950 rounded p-1 overflow-auto whitespace-pre-wrap max-h-48">
            {typeof m.content === "string" ? m.content : JSON.stringify(m.content, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}
