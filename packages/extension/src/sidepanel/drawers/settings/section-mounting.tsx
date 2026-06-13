/**
 * Placeholder for future mounting / multi-tab preferences.
 * For now the relevant policies (auto-attach via openTab, attachTab approval)
 * are managed implicitly by the BG worker; surface them once we wire toggles.
 */
export function SectionMounting() {
  return (
    <section className="bg-zinc-900 rounded p-3 space-y-1 text-xs">
      <h3 className="text-zinc-300">挂载 / 多 tab</h3>
      <p className="text-zinc-500 text-[11px]">
        默认行为：
      </p>
      <ul className="list-disc list-inside text-zinc-400 text-[11px] space-y-0.5">
        <li>当前 tab 始终挂载</li>
        <li>AI 用 <code className="text-zinc-300">openTab</code> 打开的新 tab 会自动 attach（source = ai-open）</li>
        <li>AI 用 <code className="text-zinc-300">attachTab</code> 拉入其它 tab 需要人工审阅</li>
        <li>已挂载 tab URL 变化时会标记，AI 下次调用前会提示</li>
      </ul>
    </section>
  );
}
