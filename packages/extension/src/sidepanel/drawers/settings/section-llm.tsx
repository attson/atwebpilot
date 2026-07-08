import type { LlmProvider } from "@atwebpilot/shared/types";
import { ANTHROPIC_MODELS, OPENAI_MODELS, useSettings } from "@/sidepanel/chat/settings-store";

export function SectionLlm() {
  const settings = useSettings();
  const models = settings.provider === "anthropic" ? ANTHROPIC_MODELS : OPENAI_MODELS;
  const datalistId = `models-${settings.provider}`;

  return (
    <section className="bg-zinc-900 rounded p-3 space-y-2 text-xs">
      <h3 className="text-zinc-300">LLM</h3>
      <div className="flex items-center gap-2">
        <span className="w-20 text-zinc-400">Provider</span>
        <select
          value={settings.provider}
          onChange={(e) => {
            const provider = e.target.value as LlmProvider;
            const defaults = provider === "anthropic" ? ANTHROPIC_MODELS[0] : OPENAI_MODELS[0];
            void settings.save({ provider, model: defaults });
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
            onChange={(e) => void settings.save({ model: e.target.value })}
            placeholder={settings.provider === "anthropic" ? "claude-sonnet-4-6" : "gpt-4o-mini"}
            className="bg-zinc-800 px-2 py-1 rounded font-mono"
          />
          <datalist id={datalistId}>
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <span className="w-20 text-zinc-400 mt-1">API Key</span>
        <div className="flex-1 flex flex-col gap-1">
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e) => void settings.save({ apiKey: e.target.value })}
            placeholder={settings.provider === "anthropic" ? "sk-ant-..." : "sk-..."}
            className="bg-zinc-800 px-2 py-1 rounded"
          />
          <label className="flex items-center gap-1 text-zinc-400">
            <input
              type="checkbox"
              checked={settings.apiKeyMode === "session"}
              onChange={(e) =>
                void settings.save({ apiKeyMode: e.target.checked ? "session" : "persistent" })
              }
            />
            仅本次会话保存（重启浏览器后清除）
          </label>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <span className="w-20 text-zinc-400 mt-1">Endpoint</span>
        <input
          value={settings.endpoint ?? ""}
          onChange={(e) => void settings.save({ endpoint: e.target.value })}
          placeholder={
            settings.provider === "anthropic"
              ? "留空 = https://api.anthropic.com"
              : "留空 = https://api.openai.com/v1"
          }
          className="bg-zinc-800 px-2 py-1 rounded font-mono flex-1"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-20 text-zinc-400">max_tokens</span>
        <input
          type="number"
          min={256}
          max={200000}
          step={256}
          value={settings.maxTokens ?? 4096}
          onChange={(e) => {
            const v = parseInt(e.target.value || "4096", 10);
            void settings.save({ maxTokens: Number.isFinite(v) && v > 0 ? v : 4096 });
          }}
          className="bg-zinc-800 px-2 py-1 rounded w-28"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-20 text-zinc-400">优化模型</span>
        <input
          value={settings.optimizerModel ?? ""}
          onChange={(e) => void settings.save({ optimizerModel: e.target.value })}
          placeholder="留空 = 用对话模型（推荐 haiku）"
          list={datalistId}
          className="bg-zinc-800 px-2 py-1 rounded font-mono flex-1"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-20 text-zinc-400">最大轮数</span>
        <input
          type="number"
          min={1}
          max={200}
          value={settings.maxRounds}
          onChange={(e) =>
            void settings.save({ maxRounds: parseInt(e.target.value || "20", 10) })
          }
          className="bg-zinc-800 px-2 py-1 rounded w-24"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-20 text-zinc-400">继续追问</span>
        <input
          type="number"
          min={0}
          max={5}
          value={settings.maxContinuationNudges ?? 1}
          onChange={(e) => {
            const v = parseInt(e.target.value || "1", 10);
            void settings.save({ maxContinuationNudges: Number.isFinite(v) && v >= 0 ? v : 1 });
          }}
          className="bg-zinc-800 px-2 py-1 rounded w-24"
        />
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={settings.selfHealEnabled ?? true}
          onChange={(e) => void settings.save({ selfHealEnabled: e.target.checked })}
        />
        <span className="text-zinc-300">自动自愈失败 step（默认开）</span>
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox"
          checked={settings.widgetEnabled !== false}
          onChange={(e) => void settings.save({ widgetEnabled: e.target.checked })}/>
        启用页内浮窗(每页右下角对话入口,默认开)
      </label>
      <label className="flex items-center gap-2">
        <span className="text-zinc-400">自愈 LLM 输出上限</span>
        <input
          type="number"
          min={1024}
          max={8192}
          step={512}
          value={settings.maxSelfHealOutputTokens ?? 4096}
          onChange={(e) => {
            const v = parseInt(e.target.value || "4096", 10);
            void settings.save({ maxSelfHealOutputTokens: Number.isFinite(v) && v > 0 ? v : 4096 });
          }}
          className="w-24 px-1 bg-zinc-900 border border-zinc-700 rounded"
        />
        <span className="text-zinc-400">tokens</span>
      </label>
    </section>
  );
}
