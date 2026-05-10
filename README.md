# WebPilot — AI 网页助手

一个浏览器侧边面板里的 AI 助手，能在你正在浏览的网页上：

- **读**：总结、翻译、抽取重点、回答关于本页内容的问题
- **写**：填表、勾选、选下拉、点击按钮、提交表单、上传文件
- **采**：抓主图、详情图、评论列表等结构化数据

任意一段成功对话都能一键固化为 URL 模式匹配的可重放工具。每个浏览器 tab 有独立的对话上下文，互不干扰；关掉 tab 后会话进入 5 分钟「近期会话」，可一键恢复。

---

## 装载

```bash
pnpm install
pnpm build           # 产出 dist/
```

1. `chrome://extensions` → 「开发者模式」 → 「加载已解压的扩展程序」选 `dist/`
2. 任意页面右上角点扩展图标 → 侧边面板打开

刷新扩展（reload 按钮）后，已打开的页面**第一次执行 step 时**扩展会自动注入 content script + 重试，无需手动刷新页面。

## GitHub Actions 打包

仓库包含 `.github/workflows/build-extension.yml` 自动打包流程：

- `push` / `pull_request` / 手动运行会执行 `pnpm typecheck`、`pnpm test`、`pnpm build`，并上传 `webpilot-<version>.zip` artifact。
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

名称       [WebPilot 任务 2026-05-10]
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

### 4. 多 tab 行为（Plan 4）

- 切到另一个 tab → 看到该 tab 的独立会话（消息历史、运行中状态、待审 step）
- 原 tab 的 LLM 调用在后台继续跑，UI 不可见
- 关掉 tab → 非空会话进入顶部「近期会话」5 分钟可恢复（恢复到当前 tab）
- 同 tab 内 navigate（点超链接 / SPA 路由变更）→ 会话保留 + 末尾追加一条 `[页面跳转] 新 URL: ...` 的 system note

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
pnpm typecheck      # tsc -b --noEmit
pnpm test           # 全量单元测试（~168 个）
pnpm test:watch
pnpm build          # 产出 dist/
```

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
src/
├─ shared/                 跨入口的纯函数与类型（含 static-scan / url-pattern）
├─ background/             Service Worker（IndexedDB / RPC / tab-watcher / scripting）
├─ content/                Content script + 19 个内置工具（每文件一个）
└─ sidepanel/              React UI + zustand session store + LLM 客户端
docs/superpowers/
├─ specs/                  设计文档（5 份；见 specs/README.md）
└─ plans/                  实施计划（每个对应一份 spec）
```
