import { useSettings } from "@/sidepanel/chat/settings-store";
import { DANGEROUS_TOOLS } from "@/sidepanel/lib/dangerous-tools";
import type { PermissionMode } from "@/sidepanel/chat/severity";

const MODE_LABEL: Record<PermissionMode, string> = {
  read: "只读 — 全部询问",
  default: "默认 — caution 自动，dangerous 询问",
  trust: "信任白名单 — 白名单内 dangerous 自动",
  yolo: "全自动 — 所有工具自动（不推荐）",
};

export function SectionPermissions() {
  const settings = useSettings();

  function toggleTrusted(toolId: string) {
    const next = settings.trustedDangerTools.includes(toolId)
      ? settings.trustedDangerTools.filter((t) => t !== toolId)
      : [...settings.trustedDangerTools, toolId];
    void settings.save({ trustedDangerTools: next });
  }

  return (
    <section className="bg-zinc-900 rounded p-3 space-y-2 text-xs">
      <h3 className="text-zinc-300">权限默认值</h3>
      <div className="flex items-center gap-2">
        <span className="w-24 text-zinc-400">默认模式</span>
        <select
          value={settings.defaultPermissionMode}
          onChange={(e) =>
            void settings.save({ defaultPermissionMode: e.target.value as PermissionMode })
          }
          className="bg-zinc-800 px-2 py-1 rounded flex-1"
        >
          {(["read", "default", "trust", "yolo"] as PermissionMode[]).map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m]}
            </option>
          ))}
        </select>
      </div>
      <p className="text-zinc-500 text-[10px]">新开的会话用这档模式启动。当前会话的模式在 input 工具栏切。</p>

      <div className="pt-1">
        <div className="text-zinc-400 mb-1">「信任白名单」模式下放行的 dangerous 工具</div>
        <ul className="space-y-1">
          {DANGEROUS_TOOLS.map((t) => (
            <li key={t.id}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.trustedDangerTools.includes(t.id)}
                  onChange={() => toggleTrusted(t.id)}
                  className="accent-amber-500"
                />
                <span className="text-zinc-300">{t.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
