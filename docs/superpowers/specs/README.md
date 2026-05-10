# Specs Index

按时间顺序的设计文档清单。每份 spec 对应 `../plans/` 下同名实施计划。

| # | 主题 | 文件 | 关键产出 |
|---|---|---|---|
| 1 | AI 网页采集器（初版） | [`2026-05-09-ai-collector-extension-design.md`](./2026-05-09-ai-collector-extension-design.md) | MV3 三入口架构、Tool/Step/RunRecord 数据模型、IDB 存储、9 个内置工具、URL pattern 匹配 |
| 2 | AI 对话与工具固化 | [`2026-05-10-plan2-design.md`](./2026-05-10-plan2-design.md) | 流式 Anthropic+OpenAI 适配层、tool-use 会话循环、step 卡片人工审阅、runJS 静态扫描、tab-watcher 推荐 |
| 3 | WebPilot 重定位 | [`2026-05-10-plan3-design.md`](./2026-05-10-plan3-design.md) | 9 个交互工具（fillInput / submitForm / uploadFile 等）、按工具名粒度的 dangerous 自动通过白名单、产品名 Caiji2→WebPilot |
| 4 | Per-Tab 会话 | [`2026-05-10-plan4-per-tab-sessions-design.md`](./2026-05-10-plan4-per-tab-sessions-design.md) | sessionsByTab 切片、currentTabId、closedSessions 5min 临时区、tab-tracker、闭包捕获 tabId 防 race |
| 5 | AI 生成汇总 step | [`2026-05-10-plan5-summary-step-design.md`](./2026-05-10-plan5-summary-step-design.md) | 保存对话框增 [让 AI 生成汇总步骤]；一次性非流式 LLM call 产出 runJS source；append 为最后一步使重放产物结构稳定 |

## 不在 spec 里的细节修复

以下是 spec 之外的运维/UX 修复（commit history 可查），未来如需追溯设计上下文请直接看 commit message：

- `chore: rename Caiji2 → WebPilot` — Plan 3 文案换皮（IDB DB_NAME `"caiji"` 保留）
- `fix(background): retry sendMessage with backoff after content-script inject` — @crxjs ESM loader 异步注册 listener
- `fix(background): auto-inject content script on missing receiver` — MV3 已开 tab 不会自动注入
- `fix(sidepanel-rpc): retry sendMessage on SW wake-up race` — 4 次 backoff 重试
- `fix(background): surface runJS errors instead of silently nulling output` — 用 `{__ok, value | error}` 包裹 MAIN-world 注入
- `fix(chat-page): capture tabId in send() closure for fresh-card lookups` — Plan 4 race 修补
- `feat(settings): expose maxTokens setting` — 长任务避免响应被截断
- `feat(status-bar): always show token usage` — 永不消失（done 绿、error 红、live 跳动）
- `feat(sidepanel): persistent chat session + bubble-style UI` — 切 nav 不丢；user/assistant 双气泡
- `feat(sidepanel): banner 运行 jumps to tool-detail with autoRun` — 不再丢弃 RunRecord
- `feat(tools): description actually used` — system prompt 把已保存工具喂给 AI

## 工作流约定

每份 spec 由 `superpowers:brainstorming` 技能产出（见根目录 [`AGENTS.md`](../../../AGENTS.md)）：

```
brainstorming  →  spec (本目录)  →  writing-plans  →  plan (../plans/)  →  executing-plans
```

新增 spec 命名：`YYYY-MM-DD-<topic>-design.md`（建议带 plan 编号或主题关键词）。
