import { useSettings } from "@/sidepanel/chat/settings-store";

type Theme = "light" | "dark" | "system";

const OPTIONS: Array<{ value: Theme; label: string; hint: string }> = [
  { value: "dark", label: "深色", hint: "默认，对眼睛友好" },
  { value: "light", label: "浅色", hint: "白天 / 截屏" },
  { value: "system", label: "跟随系统", hint: "依 OS 的 prefers-color-scheme" },
];

export function SectionAppearance() {
  const settings = useSettings();
  const theme = settings.theme ?? "dark";

  function pick(v: Theme) {
    void settings.save({ theme: v });
  }

  return (
    <section className="bg-zinc-900 rounded p-3 space-y-2 text-xs">
      <h3 className="text-zinc-300">外观</h3>
      <div className="space-y-1.5">
        {OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="theme"
              value={opt.value}
              checked={theme === opt.value}
              onChange={() => pick(opt.value)}
              className="mt-0.5 accent-blue-500"
            />
            <div>
              <div className="text-zinc-100">{opt.label}</div>
              <div className="text-zinc-500 text-[10px]">{opt.hint}</div>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
