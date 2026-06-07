# AtWebPilot — AI 网页助手

一个浏览器侧边面板里的 AI 助手，能在你正在浏览的网页上：

- **读**：总结、翻译、抽取重点、回答关于本页内容的问题
- **写**：填表、勾选、选下拉、点击按钮、提交表单、上传文件
- **采**：抓主图、详情图、评论列表等结构化数据

任意一段成功对话都能一键固化为 URL 模式匹配的可重放工具。每个浏览器 tab 有独立的对话上下文，互不干扰；按 URL 持久化历史会话（每个 URL ≤20 条），切回时通过顶部历史 drawer 一键恢复，关 tab 不丢。

---

## 安装

只想 **用**（不开发）：

    claude mcp add atwebpilot --scope user -- npx -y @attson/atwebpilot-mcp

然后下载 [最新 release zip](https://github.com/attson/atwebpilot/releases/latest)，在
`chrome://extensions` 加载已解压扩展，扩展设置 → Coordinator 填
`ws://127.0.0.1:8787/worker` → 连接。

可选环境变量：`ATWEBPILOT_WS_PORT`（默认 8787）、`ATWEBPILOT_WS_TOKEN`（可选）。

---

## 装载

```bash
pnpm install
pnpm build           # 产出 packages/extension/dist/
```

1. `chrome://extensions` → 「开发者模式」 → 「加载已解压的扩展程序」选 `packages/extension/dist/`
2. 任意页面右上角点扩展图标 → 侧边面板打开

刷新扩展（reload 按钮）后，已打开的页面**第一次执行 step 时**扩展会自动注入 content script + 重试，无需手动刷新页面。

## GitHub Actions 打包

仓库包含 `.github/workflows/build-extension.yml` 自动打包流程：

- `push` / `pull_request` / 手动运行会执行 `pnpm typecheck`、`pnpm test`、`pnpm build`，并上传 `atwebpilot-<version>.zip` artifact。
- 推送 `v*` tag（例如 `v0.0.1`）会在通过检查后创建 GitHub Release，并上传同一个 zip。
- zip 内容来自 `dist/` 内部，`manifest.json` 位于压缩包根目录，可直接用于 Chrome 扩展加载或发布前检查。

发布示例：

```bash
git tag v0.0.1
git push origin v0.0.1
```

---

## 第一次配置

打开「设置」页：

| 字段 | 说明 |
|---|---|
| Provider | Anthropic / OpenAI（也支持 OpenAI 兼容协议接 LiteLLM / Azure / Ollama 等） |
| Endpoint | 留空 = 默认；也可填自定义 base URL（例如 `https://api.deepseek.com/v1`） |
| Model | 下拉建议或自由输入（如 `claude-sonnet-4-6`、`gpt-4o-mini`、`deepseek-chat`） |
| API Key | 「仅本次会话保存」勾选 = 关浏览器即清；否则存 `chrome.storage.local` |
| max_tokens | 单次 LLM 响应上限（默认 4096，长任务可调 8192/16k） |
| 最大轮数 | 一次会话最多 LLM round 数，默认 20 |
| 续作 nudge 次数 | 模型说完没调工具时再问一遍是否真完成；默认 1，session-total 上限 |
| 自动通过策略 | safe 永远 auto；caution 看勾选；dangerous 按工具名白名单（5 选 N） |

API Key 不会进 IndexedDB，也不会被「导出工具库」带走。

---

## 用法

### 1. 对话页（默认）

```
[Tab #142] mobile.pinduoduo.com/goods.html?...
─────────────────────────────────────────────
▶ 此页面可用 1 个工具:
  · pdd 竞品信息采集 v3      [详情] [运行]
─────────────────────────────────────────────

✓ 已完成 · round 8/20 · in 5.2k / out 1.8k (= 7.0k)

(消息流)
─────────────────────────────────────────────
☑ 自动通过 caution     ⚠ dangerous 自动: 0/5 ▾
要让 AI 做什么？例如"总结此页"/"填写注册表单"/"采集前 50 条评论"
                                              [发送]
```

输入指令 → AI 流式回应 + 调用工具：

- **safe**（snapshotDOM / extractText / hover / getValue / scroll / waitFor / extractImages / querySelector* / extractFormState）：自动跑
- **caution**（fillInput / click / setCheckbox / selectOption / 不带 cookie 的 httpRequest）：默认跟随顶部 toggle
- **dangerous**（submitForm / uploadFile / readStorage / 带 cookie 的 httpRequest / 命中静态扫描的 runJS）：每次必须人工确认；可在白名单里逐项放行

完成后顶部小条 `已执行 N 步 [保存为工具]`——点击后弹保存对话框。

### 2. 保存为工具

```
保存为工具

名称       [AtWebPilot 任务 2026-05-10]
URL 模式   [https://*.pinduoduo.com/**]
描述       [采集 PDD 评论与主图（用户初始 prompt）]

┌─ 汇总 step ──────────────────────────────────┐
│ ⚠ 重放时输出 = 最后一步 step 的 return 值。 │
│ [让 AI 生成汇总步骤]                          │
└──────────────────────────────────────────────┘

将保存 9 个成功执行的 step。

[取消] [保存]
```

**汇总 step**（Plan 5 新增）：会话期间 AI 在 chat 文本里写的"总结报告"是 markdown，重放无法复现；点击 [让 AI 生成汇总步骤] 会让 LLM 基于已执行 step + 对话历史生成一段 runJS code（追加为最后一步）——重放时该 step 把前面 step 的产物整合成稳定结构 JSON。

### 3. 工具库

- 顶部 `[导入 JSON]` 接受单条或多条工具 bundle（按 id 合并；冲突跳过）
- 每行 `[详情] [导出] [删除]` —— 单工具导出 JSON
- 工具详情页：步骤定义折叠；运行按钮在最显眼位置；运行结果（绿框）显示在按钮正下方
- banner 上的「运行」 = 跳工具详情页 + 自动开跑

### 4. 多 tab 与会话历史（Plan 4 + 7 + 8）

- 切到另一个 tab → 看到该 tab 的独立会话（消息历史、运行中状态、待审 step）
- 原 tab 的 LLM 调用在后台继续跑，UI 不可见
- 一个会话可以同时挂多个 tab：
  - 在输入框 `@` 提一个 URL 把另一个 tab 拉进会话
  - AI 可以用 `openTab(url)` 打开新 tab，成功后自动 attach（source=`ai-open`）
  - 也可以 `attachTab(tabId)` 申请把任意 tab 纳入（需用户审阅）
  - 19 个内置工具都接受可选 `tabId` 参数指向某个已 attached tab
- 会话按 URL 持久化（IndexedDB `chat_sessions`，每 URL ≤20 条）→ 关 tab 不丢；切回原 URL 通过顶部历史 drawer 一键恢复，或新建会话
- 同 tab 内 navigate（点超链接 / SPA 路由变更）→ 会话保留 + 末尾追加一条 `[页面跳转] 新 URL: ...` 的 system note

### 5. 后台 LLM 交流记录（Plan 11）

每次 LLM stream 的 request（去掉 apiKey）和组装后的 response 都会被 `recording-client` 抓下来，按 round 存进会话；右上角 `Exchanges N [查看]` 打开专用面板，定位 prompt cache / continuation guard / stop_reason 这类调参问题不再靠盲猜。

---

## 失败修复

工具运行失败时，工具详情页出现 `[让 AI 修复]`。点击 → 跳到对话页 → 自动预填错误上下文 + 旧 step 数组 → 你点[发送]，AI 改新版 step。修复成功后保存为新版本（`appendVersion`）。

---

## 日志

每个会话顶部小条 `日志 N 条 [查看]` —— 展开底部抽屉看每个 SessionEvent（含 LLM stream error 与 step error 详情）。报错时自动展开。可一键复制成文本提 issue。

---

## DEV 入口

「DEV: JSON」页保留了 Plan 1 的"粘 Tool JSON 直接跑"，方便调试工具或验证 step 序列；不走 LLM。

---

## 工具集（19 个 BuiltinTool + runJS）

| 类别 | 工具 |
|---|---|
| 探查（safe） | `snapshotDOM`、`querySelector`、`querySelectorAll`、`extractText`、`extractImages`、`getValue`、`extractFormState`、`hover`、`focus` |
| 流程（safe） | `scroll`、`waitFor` |
| 交互（caution） | `click`、`fillInput`、`setCheckbox`、`selectOption` |
| 网络（caution） | `httpRequest`（无 cookie）、`runJS`（扫描通过） |
| dangerous | `submitForm`、`uploadFile`、`readStorage`、`httpRequest(withCredentials)`、`runJS`（含 cookie/eval/storage 等关键词） |

---

## 测试与构建

```bash
pnpm typecheck      # pnpm -r typecheck across shared / coordinator / extension
pnpm test           # 全量测试 ~492（346 extension + 101 shared + 45 coordinator）
pnpm test:watch
pnpm build          # 产出 packages/extension/dist/
```

测试覆盖：纯逻辑（url-pattern / static-scan / infer-json-schema / protocol zod）+ 工具调用层（每个内置工具一组 happy-dom 测试）+ chat loop（含 continuation guard）+ WS 协议端到端（起真 `ws` server 跑 HELLO / EXEC / START_CHAT_SESSION）。无 Playwright；UI smoke 是手动。

---

## Coordinator 远程控制（Plan 10 + 12，opt-in）

设置页有「Coordinator」子页：填一个 WS URL + token 即可让扩展挂到任意符合协议的服务器，被远程派发工具步（EXEC）。WS 协议见 `packages/shared/src/protocol/messages.ts`，参考实现见 `packages/coordinator/`。

Plan 12 之后还可以远程驱动一整个 chat session（`START_CHAT_SESSION`），并把会话事件（`CHAT_EVENT`）流式发回：仅在勾上「允许 coordinator 远程驱动 chat session」之后生效，默认关闭，独立于 EXEC 工具调用。BG 端跑的是同一个 `runChatSession`，可以走真实 LLM，也可以由 server 端直接喂一段 `mock_llm: { rounds: LlmStreamEvent[][] }` 做确定性回归测试。

本地 smoke：

```bash
node docs/superpowers/scripts/mini-coordinator.mjs
# 在设置里填 ws://127.0.0.1:8787/worker + 任意 token → 连接
```

### 用 Claude Code 驱动浏览器（MCP Bridge，Plan 13）

`packages/mcp-server` 是一个 stdio MCP server，同时起本地 ws 服务器。Claude Code 连它后可调
`list_tabs / open_session / browser_*（19 个）/ get_quota / close_session` 在网页上读写采。

    pnpm -F @atwebpilot/mcp-server start   # 监听 ws://127.0.0.1:8787/worker（tsx 直跑）
    # 扩展设置页填该 URL + token → 连接；Claude Code 侧把它配成 MCP server

详见 `packages/mcp-server/README.md`。

---

## 手测脚本（需要真 API Key）

### 阅读：总结
1. 维基百科任意条目
2. 输入「用三个要点总结此页」
3. 期望：AI 用 `snapshotDOM + extractText`（safe，自动）→ 给三个要点

### 操作：填表
1. https://httpbin.org/forms/post
2. 输入「填写：客户名 张三，电话 13800000000，比萨配料勾选 mushroom 和 cheese，配送时间 18:00」
3. 期望：`fillInput` / `setCheckbox` / `selectOption`（caution）；`submitForm` 要审阅
4. 不点提交退出，验证字段已填

### 采集：PDD
1. https://mobile.pinduoduo.com/goods.html?goods_id=<任一商品>
2. 输入「把主图、详情图、前 50 条评论采集出来」
3. 期望：snapshotDOM → 探查 window.rawData → httpRequest 翻页评论 → 汇总
4. 完成后保存为工具，并点击「让 AI 生成汇总步骤」让重放产物结构稳定
5. 重新访问验证 banner 推荐 + [运行] 自动跑 + ResultView 显示结构化 JSON

### 多 tab
1. tab A 跑「采主图」，AI 还在跑时切到 tab B
2. tab B 输入「总结此页」
3. 切回 tab A，应该看到 A 的进度（不是 B 的会话）
4. 关掉 tab B → 顶部「近期会话」出现可恢复条目

---

## 仓库目录

详细见 [`AGENTS.md`](./AGENTS.md)（给 AI 协作者的导航）。简版：

```
packages/
├─ shared/                 纯函数 + 类型 + WS 协议 zod schemas（无 chrome / 无 DOM）
├─ coordinator/            参考 WS 服务器实现（测试用；生产可外置）
├─ mcp-server/             stdio MCP server（Claude Code 经本地 ws 驱动浏览器，Plan 13）
└─ extension/
   └─ src/
      ├─ background/       Service Worker（IDB / RPC / tab-watcher / coordinator-client）
      ├─ content/          Content script + 19 个内置工具（每文件一个）
      └─ sidepanel/        React UI + zustand session store + LLM 客户端 + coordinator 设置页
docs/superpowers/
├─ specs/                  设计文档（12 份；见 specs/README.md）
├─ plans/                  实施计划（每份对应一份 spec）
└─ scripts/                辅助脚本（含 mini-coordinator.mjs 本地 smoke）
```
