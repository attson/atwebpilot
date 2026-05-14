import { DangerApprovalList } from "./danger-approval-list";

export function DangerApprovalGroup() {
  return (
    <section className="bg-zinc-900 rounded p-3 space-y-2">
      <h3 className="text-zinc-300">自动通过策略</h3>
      <p className="text-zinc-500">
        safe 工具永远自动；caution 工具看下方 toggle；dangerous 工具按下方白名单逐项允许。
      </p>
      <div className="pt-1">
        <span className="text-zinc-400">允许自动执行的 dangerous 工具：</span>
      </div>
      <div className="pl-2 border-l-2 border-zinc-700">
        <DangerApprovalList />
      </div>
      <p className="text-[11px] text-amber-400">
        ⚠ 勾选意味着这一类调用不再人工确认。
      </p>
    </section>
  );
}
