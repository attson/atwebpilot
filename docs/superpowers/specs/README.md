# Specs Index

按时间顺序的设计文档清单。每份 spec 对应 `../plans/` 下同名实施计划。

| # | 主题 | 文件 | 关键产出 |
|---|---|---|---|
| 1 | AI 网页采集器（初版） | [`2026-05-09-ai-collector-extension-design.md`](./2026-05-09-ai-collector-extension-design.md) | MV3 三入口架构、Tool/Step/RunRecord 数据模型、IDB 存储、9 个内置工具、URL pattern 匹配 |
| 2 | AI 对话与工具固化 | [`2026-05-10-plan2-design.md`](./2026-05-10-plan2-design.md) | 流式 Anthropic+OpenAI 适配层、tool-use 会话循环、step 卡片人工审阅、runJS 静态扫描、tab-watcher 推荐 |
| 3 | WebPilot 重定位 | [`2026-05-10-plan3-design.md`](./2026-05-10-plan3-design.md) | 9 个交互工具（fillInput / submitForm / uploadFile 等）、按工具名粒度的 dangerous 自动通过白名单、产品名 Caiji2→WebPilot |
| 4 | Per-Tab 会话 | [`2026-05-10-plan4-per-tab-sessions-design.md`](./2026-05-10-plan4-per-tab-sessions-design.md) | sessionsByTab 切片、currentTabId、closedSessions 5min 临时区、tab-tracker、闭包捕获 tabId 防 race |
| 5 | AI 生成汇总 step | [`2026-05-10-plan5-summary-step-design.md`](./2026-05-10-plan5-summary-step-design.md) | 保存对话框增 [让 AI 生成汇总步骤]；一次性非流式 LLM call 产出 runJS source；append 为最后一步使重放产物结构稳定 |
| 6 | AI 生成两类工具 | [`2026-05-12-ai-generated-tool-types-design.md`](./2026-05-12-ai-generated-tool-types-design.md) | 保存为工具先选提示词/纯函数；AI 总结多轮对话生成 name/description/prompt 或 steps；提示词工具运行时跳聊天自动发送 |
| 7 | 多 tab 上下文 | [`2026-05-14-multi-tab-context-design.md`](./2026-05-14-multi-tab-context-design.md) | 一个会话内 `attachedTabs` 集合 + 三种信任入口（@ / openTab / attachTab）；现有 19 工具加可选 `tabId`；新增 listTabs/openTab/attachTab/detachTab 控制面；跨窗口、URL 变更显式追踪 |
| 8 | 侧边面板会话持久化与多会话历史 | [`2026-05-19-sidepanel-session-persistence-design.md`](./2026-05-19-sidepanel-session-persistence-design.md) | IDB `chat_sessions` store；按 tabId 主 URL 副；同 tab 多 archived 历史 + 新建会话；URL banner 与历史 drawer 替代 5 分钟内存 closedSessions；每 URL ≤20 + cascade 删 runs |
| 9 | GitHub Actions 打包 | [`2026-05-11-github-actions-extension-package-design.md`](./2026-05-11-github-actions-extension-package-design.md) | `build-extension.yml`：push/PR/手动跑 typecheck+test+build 并上传 `webpilot-<version>.zip`；推 `v*` tag 自动创建 GitHub Release；版本号从 tag 注入到 manifest |
| 10 | Remote Coordinator（Phase 1+2） | [`2026-05-15-remote-coordinator-design.md`](./2026-05-15-remote-coordinator-design.md) | WS 协议（zod envelope + 14 消息）+ coordinator core（worker registry / session manager / dispatcher / catalog hash）；扩展端 `CoordinatorClient` 单实例 + chrome.alarms 心跳 + 重连退避；HELLO/WELCOME/EXEC/RESULT 端到端跑通；ws subprotocol `bearer.<token>` |
| 11 | Raw LLM Exchange Log + Continuation Guard | [`2026-05-23-raw-llm-exchange-log-design.md`](./2026-05-23-raw-llm-exchange-log-design.md) | recording-client.ts 包 LlmClient 抓 request/response（屏蔽 apiKey），独立查看面板按 round 浏览；同期落地 continuation guard：text-only turn 不再直接 done，按 `maxContinuationNudges` 询问是否补完（v0.0.15 修复 nudge 死循环：改成 session-total 上限） |
| 12 | Remote-Testable Chat Session | [`2026-06-04-remote-testable-chat-design.md`](./2026-06-04-remote-testable-chat-design.md) | 在 Phase 2 coordinator 之上加 `START_CHAT_SESSION` / `ABORT_SESSION` / `READ_SIDEPANEL_STATE` / `CHAT_EVENT` / `SIDEPANEL_STATE_REPLY`；BG 端 `CoordinatorChatHost` 用 `MockLlmClient` + `BackgroundToolRunner` 跑同一个 `runChatSession()`；默认关闭的 `allow_remote_chat` opt-in；RunRecord 加 `source:"user" \| "coordinator"` 标签；sidepanel chat 路径零改动 |
| 13 | MCP Bridge（Phase 3） | [`2026-06-06-mcp-bridge-design.md`](./2026-06-06-mcp-bridge-design.md) | 新包 `packages/mcp-server`：stdio MCP server + `LoopbackWSHub`（真 ws + req_id↔RESULT 配对）复用 Coordinator 门面；启动时从 `TOOL_DEFS`（上提到 shared）自动生成 19 个 `browser_*` 工具 + 4 个控制面工具（list_tabs/open_session/close_session/get_quota）；本地单人 EXEC 模式，让 Claude Code 经 coordinator 驱动浏览器 |

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
