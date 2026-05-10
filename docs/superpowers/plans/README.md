# Plans Index

每份 plan 对应一份 [`../specs/`](../specs/README.md) 设计文档。Plan 是按 task 切分的实施清单（含完整代码和测试）；`superpowers:executing-plans` 或 `superpowers:subagent-driven-development` 可以直接执行。

| # | 实施计划 | task 数 | 测试增量 | 总测试数 |
|---|---|---|---|---|
| 1 | [`2026-05-09-plan1-executable-skeleton.md`](./2026-05-09-plan1-executable-skeleton.md) | 30 | 51 | 51 |
| 2 | [`2026-05-10-plan2-ai-conversation.md`](./2026-05-10-plan2-ai-conversation.md) | 26 | +37 | 88 |
| 3 | [`2026-05-10-plan3-webpilot.md`](./2026-05-10-plan3-webpilot.md) | 29 | +46 | 134 |
| 4 | [`2026-05-10-plan4-per-tab-sessions.md`](./2026-05-10-plan4-per-tab-sessions.md) | 13 | +16 | 150 |
| 5 | [`2026-05-10-plan5-summary-step.md`](./2026-05-10-plan5-summary-step.md) | 6 | +18 | 168 |

各 plan 的 task 严格 TDD：写失败测试 → 实现 → 验证通过 → commit。每 task 一组 commit；plan 内的 commit 加起来构成一次完整 feature。

## 跑通某份 plan

```bash
# 阅读 plan
$EDITOR docs/superpowers/plans/2026-05-10-plan5-summary-step.md

# 选其一：
# 在当前 session 内逐 task 推进
superpowers:executing-plans

# 或派 subagent，主 context 不耗
superpowers:subagent-driven-development
```

## 不在 plan 里的修复

参见 [`../specs/README.md`](../specs/README.md) 末尾的 "不在 spec 里的细节修复" 列表，以及 `git log --oneline` 中以 `fix:` / `feat(...):` 开头的零散提交。
