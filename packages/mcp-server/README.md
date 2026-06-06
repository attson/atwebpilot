# @webpilot/mcp-server

让 Claude Code 经本地 coordinator 驱动 WebPilot 扩展操作浏览器（EXEC 模式）。

## 启动

    WEBPILOT_WS_PORT=8787 WEBPILOT_WS_TOKEN=dev pnpm -F @webpilot/mcp-server start

（内部用 `tsx` 直跑 TypeScript；也可 `npx tsx packages/mcp-server/src/index.ts`。）

监听 `ws://127.0.0.1:8787/worker`。在扩展设置页 → Coordinator 子页填该 URL + token=`dev` → 连接。

## Claude Code MCP 配置（示例）

    {
      "mcpServers": {
        "webpilot": {
          "command": "tsx",
          "args": ["packages/mcp-server/src/index.ts"],
          "env": { "WEBPILOT_WS_PORT": "8787", "WEBPILOT_WS_TOKEN": "dev" }
        }
      }
    }

## 工具

- `list_tabs` → `open_session(tab_id)` → `browser_*(session_id, …)` → `close_session`
- 19 个 `browser_*` 自动从扩展 TOOL_DEFS 生成；`get_quota` 查预算。

⚠ 进程禁止往 stdout 写非 MCP 内容（stdout 是 MCP 通道）。环境变量：`WEBPILOT_WS_PORT`（默认 8787）、`WEBPILOT_WS_TOKEN`（可选，配置后要求 worker 用 `bearer.<token>` 子协议）。
