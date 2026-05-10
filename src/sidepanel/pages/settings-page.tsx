import { useEffect, useState } from "react";
import { rpc } from "../rpc";
import {
  ANTHROPIC_MODELS,
  OPENAI_MODELS,
  useSettings
} from "../chat/settings-store";
import type { LlmProvider } from "@/shared/types";

export function SettingsPage() {
  const settings = useSettings();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.loaded) settings.load();
  }, [settings]);

  const models = settings.provider === "anthropic" ? ANTHROPIC_MODELS : OPENAI_MODELS;
  const datalistId = `models-${settings.provider}`;

  async function doExport() {
    setMsg(null); setErr(null);
    try {
      const bundle = await rpc.exportAll();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `caiji-tools-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`导出 ${bundle.tools.length} 个工具`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function doImport(file: File) {
    setMsg(null); setErr(null);
    try {
      const text = await file.text();
      const bundle = JSON.parse(text);
      const r = await rpc.importBundle(bundle);
      setMsg(`已导入 ${r.imported} 个，跳过 ${r.skipped} 个`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="p-3 flex flex-col gap-3 text-xs">
      <h2 className="text-base font-medium">设置</h2>

      <section className="bg-zinc-900 rounded p-3 space-y-2">
        <h3 className="text-zinc-300">LLM</h3>
        <div className="flex items-center gap-2">
          <span className="w-20 text-zinc-400">Provider</span>
          <select
            value={settings.provider}
            onChange={(e) => {
              const provider = e.target.value as LlmProvider;
              const defaults = provider === "anthropic" ? ANTHROPIC_MODELS[0] : OPENAI_MODELS[0];
              settings.save({ provider, model: defaults });
            }}
            className="bg-zinc-800 px-2 py-1 rounded"
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-20 text-zinc-400 mt-1">Model</span>
          <div className="flex-1 flex flex-col gap-1">
            <input
              list={datalistId}
              value={settings.model}
              onChange={(e) => settings.save({ model: e.target.value })}
              placeholder={settings.provider === "anthropic" ? "claude-sonnet-4-6" : "gpt-4o-mini"}
              className="bg-zinc-800 px-2 py-1 rounded font-mono"
            />
            <datalist id={datalistId}>
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <span className="text-zinc-500">
              下拉列出预设；可任意填（自建网关 / LiteLLM 代理跑 deepseek、qwen、kimi 等）。
            </span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-20 text-zinc-400 mt-1">API Key</span>
          <div className="flex-1 flex flex-col gap-1">
            <input
              type="password"
              value={settings.apiKey}
              onChange={(e) => settings.save({ apiKey: e.target.value })}
              placeholder={settings.provider === "anthropic" ? "sk-ant-..." : "sk-..."}
              className="bg-zinc-800 px-2 py-1 rounded"
            />
            <label className="flex items-center gap-1 text-zinc-400">
              <input
                type="checkbox"
                checked={settings.apiKeyMode === "session"}
                onChange={(e) =>
                  settings.save({ apiKeyMode: e.target.checked ? "session" : "persistent" })
                }
              />
              仅本次会话保存（重启浏览器后清除）
            </label>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-20 text-zinc-400 mt-1">Endpoint</span>
          <div className="flex-1 flex flex-col gap-1">
            <input
              value={settings.endpoint ?? ""}
              onChange={(e) => settings.save({ endpoint: e.target.value })}
              placeholder={
                settings.provider === "anthropic"
                  ? "留空 = https://api.anthropic.com"
                  : "留空 = https://api.openai.com/v1"
              }
              className="bg-zinc-800 px-2 py-1 rounded font-mono"
            />
            <span className="text-zinc-500">
              自定义 base URL（含 /v1 等版本路径）。可接 LiteLLM、Azure、自建网关、Ollama 等。
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-20 text-zinc-400">最大轮数</span>
          <input
            type="number"
            min={1}
            max={200}
            value={settings.maxRounds}
            onChange={(e) => settings.save({ maxRounds: parseInt(e.target.value || "20", 10) })}
            className="bg-zinc-800 px-2 py-1 rounded w-24"
          />
        </div>
      </section>

      <section className="bg-zinc-900 rounded p-3 space-y-2">
        <h3 className="text-zinc-300">备份</h3>
        <div className="flex gap-2">
          <button onClick={doExport} className="px-3 py-1 bg-zinc-700 rounded">
            导出工具库 JSON
          </button>
          <label className="px-3 py-1 bg-zinc-700 rounded cursor-pointer">
            导入 JSON
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) doImport(f);
              }}
            />
          </label>
        </div>
        <p className="text-zinc-500">
          导出 / 导入只包含 tools。API Key、运行记录不在内。冲突默认 skip。
        </p>
      </section>

      {msg && <div className="text-emerald-400">{msg}</div>}
      {err && <div className="text-red-400">{err}</div>}
    </div>
  );
}
