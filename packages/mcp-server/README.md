# @attson/atwebpilot-mcp

让 Claude Code 经一个本地 ws 中继驱动 atwebpilot 浏览器扩展操作网页（读 / 写 / 采）。

## 给用户：一行装

    claude mcp add atwebpilot --scope user -- npx -y @attson/atwebpilot-mcp

可选环境变量：

- `ATWEBPILOT_WS_PORT`（默认 8787）：本地 ws 监听端口
- `ATWEBPILOT_WS_TOKEN`（可选）：扩展连接时要求 `bearer.<token>` 子协议

然后[下载 release zip](https://github.com/attson/atwebpilot/releases/latest) 加载已解压扩展，
在扩展设置 → Coordinator 子页填 `ws://127.0.0.1:8787/worker` → 连接。新会话 Claude 调
`list_tabs` 即可看到当前标签页。

## 给开发者：本地 monorepo

    pnpm -F @attson/atwebpilot-mcp start

环境变量同上，路径用 `tsx src/index.ts` 直跑（包内 `start` script 已封）。

## 工具面

- 控制面 4 个：`list_tabs / open_session / close_session / get_quota`
- 执行面 19 个 `browser_*`：snapshotDOM / click / fillInput / setCheckbox / selectOption / extractText / extractImages / submitForm / uploadFile / readStorage / httpRequest / scroll / waitFor / hover / focus / getValue / extractFormState / querySelector / querySelectorAll

详细协议与设计见 [`../../docs/superpowers/specs/2026-06-06-mcp-bridge-design.md`](../../docs/superpowers/specs/2026-06-06-mcp-bridge-design.md)。

⚠ 进程禁止往 stdout 写非 MCP 内容（stdout 是 MCP 通道）。所有日志走 stderr。
