import { useState } from "react";
import { inferJsonSchema } from "@/shared/infer-json-schema";
import type { Json, Step } from "@/shared/types";
import { rpc } from "../rpc";

type Props = {
  initialName: string;
  initialDescription: string;
  initialUrl: string;
  steps: Step[];
  lastOutput: Json;
  onClose: () => void;
  onSaved: (toolId: string) => void;
};

function defaultPattern(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const baseHost = host.split(".").slice(-2).join(".");
    return `https://*.${baseHost}/**`;
  } catch {
    return "https://example.com/**";
  }
}

export function SaveAsToolDialog(props: Props) {
  const [name, setName] = useState(props.initialName || "新工具");
  const [description, setDescription] = useState(props.initialDescription || "");
  const [patternsText, setPatternsText] = useState(defaultPattern(props.initialUrl));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    setBusy(true);
    try {
      const urlPatterns = patternsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (urlPatterns.length === 0) throw new Error("至少填一个 URL 模式");
      if (props.steps.length === 0) throw new Error("没有可保存的成功 step");
      const tool = await rpc.saveTool({
        name,
        urlPatterns,
        description,
        steps: props.steps,
        outputSchema: inferJsonSchema(props.lastOutput)
      });
      props.onSaved(tool.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10">
      <div className="bg-zinc-900 rounded p-4 w-[90%] max-w-md text-xs flex flex-col gap-2">
        <h3 className="text-base font-medium">保存为工具</h3>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-400">名称</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-zinc-800 px-2 py-1 rounded"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-400">URL 模式（每行一条）</span>
          <textarea
            value={patternsText}
            onChange={(e) => setPatternsText(e.target.value)}
            rows={3}
            className="bg-zinc-800 px-2 py-1 rounded font-mono"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-400">描述</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="bg-zinc-800 px-2 py-1 rounded"
          />
        </label>
        <p className="text-zinc-500">将保存 {props.steps.length} 个成功执行的 step。</p>
        {err && <p className="text-red-400">{err}</p>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={props.onClose}
            className="px-3 py-1 bg-zinc-700 rounded"
            disabled={busy}
          >
            取消
          </button>
          <button
            onClick={save}
            className="px-3 py-1 bg-emerald-700 rounded disabled:opacity-50"
            disabled={busy}
          >
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
