# MCP Bridge — Claude Code 驱动浏览器

## 概念

MCP Bridge = stdio MCP server + 本地 Coordinator，两者打包在 `@attson/atwebpilot-mcp`。装了之后：

```
Claude Code ─(MCP stdio)─→ atwebpilot-mcp ─(WS worker)─→ Chrome 扩展 ─→ 网页
```

Claude Code 里就能调 `browser_*` 系列工具在真实网页上读、写、采。

## 安装

```bash
claude mcp add atwebpilot --scope user -- npx -y @attson/atwebpilot-mcp
```

然后照常装扩展。扩展 → 设置 → Coordinator 填 `ws://127.0.0.1:8787/worker` → 连接。

可选环境变量：
- `ATWEBPILOT_WS_PORT`（默认 8787）
- `ATWEBPILOT_WS_TOKEN`（可选；填了扩展 side 也要填同样 token）

## Claude Code 可用的 MCP tools

| 工具 | 用途 |
|---|---|
| `list_tabs` | 列出扩展当前挂载的所有 tab |
| `open_session` | 开启一个 chat session，绑定某 tab |
| `browser_snapshotDOM` / `browser_takeSnapshot` / ... × 19 | 内置工具的 MCP 包装 |
| `get_quota` | 查询当前 session 剩余次数 |
| `close_session` | 关闭 session |

19 个 `browser_*` 与扩展内置工具一一对应，参数一致。详见 [工具参考](/tools/overview)。

## 手起 mcp-server（开发用）

```bash
pnpm -F @atwebpilot/mcp-server start
```

监听 `ws://127.0.0.1:8787/worker`。用于本地调试 mcp-server 逻辑，不用装 npx 包。

详见 `packages/mcp-server/README.md`。
