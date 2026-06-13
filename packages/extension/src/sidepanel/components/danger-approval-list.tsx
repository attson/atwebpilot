import { useSettings } from "../chat/settings-store";

const ITEMS: Array<{ name: string; label: string; description: string }> = [
  {
    name: "submitForm",
    label: "submitForm",
    description: "提交表单（会触发服务端动作）"
  },
  {
    name: "uploadFile",
    label: "uploadFile",
    description: "上传文件"
  },
  {
    name: "readStorage",
    label: "readStorage",
    description: "读 localStorage / sessionStorage"
  },
  {
    name: "httpRequest",
    label: "httpRequest(带 cookie)",
    description: "带登录会话发请求（withCredentials=true 时为 dangerous）"
  },
  {
    name: "runJS",
    label: "runJS(扫描命中)",
    description: "含 cookie/eval/storage 的脚本（任何 dangerous 级别 runJS）"
  },
  {
    name: "attachTab",
    label: "始终允许 AI 跨 tab 访问 (attachTab)",
    description: "AI 调用 attachTab 不再每次弹审批；@ 选中和 AI 自开新 tab 不受此项影响"
  }
];

export const DANGEROUS_TOTAL = ITEMS.length;

export function DangerApprovalList() {
  const settings = useSettings();
  const allowlist = settings.trustedDangerTools ?? [];

  function toggle(name: string) {
    const next = allowlist.includes(name)
      ? allowlist.filter((n) => n !== name)
      : [...allowlist, name];
    settings.save({ trustedDangerTools: next });
  }

  return (
    <ul className="flex flex-col gap-1 text-xs">
      {ITEMS.map((it) => (
        <li key={it.name} className="flex items-start gap-2">
          <input
            type="checkbox"
            id={`dangerous-${it.name}`}
            checked={allowlist.includes(it.name)}
            onChange={() => toggle(it.name)}
            className="mt-0.5"
          />
          <label htmlFor={`dangerous-${it.name}`} className="flex-1 cursor-pointer">
            <span className="text-zinc-200">{it.label}</span>
            <span className="text-zinc-500"> — {it.description}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
