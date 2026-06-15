# Round 6 — 4 个常用工具补齐

**状态**：草稿 · 2026-06-15 · 作者：assistant + attson

新增 4 个 LLM 工具填补当前最常被 `runJS` 兜底的几个场景：
`navigate` / `getPageInfo` / `pressKey` / `writeStorage`。

## 1 · 背景

调研发现：

- **Tier-3 5 个 control-plane 工具**（`closeTab` / `switchToTab` / `searchBookmarks` / `searchHistory` / `downloadImage`）在 Round 5 之后已实装，走 sidepanel-side `metaTools` 路径（`packages/extension/src/sidepanel/lib/meta-tools.ts`），不在 content-script `TOOLS` map 里。
- `screenshot` / `askUser` / `listTabs` / `openTab` / `attachTab` / `detachTab` 也都已在 LLM 工具列表中。
- 但日常对话里 LLM **仍频繁退化到 `runJS`** 处理几类常见需求：刷新 / 回退、读当前页基本信息、按 Enter/Escape、写一条 localStorage。本轮把这 4 个抽成显式工具，给到 schema、severity 与 replay 支持。

## 2 · 非目标

- 增加视觉坐标点击（AIPex computerTool），仍由 `clickByUid` 覆盖
- 提供 `copyToClipboard` / `getCookies` / `setCookies`（增量低或隐私敏感）
- 调整既有工具描述或 system prompt（除了为新工具加 1-2 句示例）
- 替换或弃用 `runJS`（仍保留作兜底）

## 3 · 4 个新工具

### 3.1 `navigate`

content-script 路径。

```ts
{
  name: "navigate",
  description:
    "[ACT] 页面导航：后退 / 前进 / 重载 / 跳转。\n" +
    "**优先**用本工具而不是 runJS('location.href = ...')。\n" +
    "示例：\n" +
    "- 后退一页：{ action: 'back' }\n" +
    "- 跳到新 URL：{ action: 'goto', url: 'https://example.com/page' }",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["back", "forward", "reload", "goto"] },
      url: { type: "string", description: "仅 action=goto 时使用" },
      tabId: TAB_ID_FIELD
    },
    required: ["action"]
  }
}
```

实现要点：

- `back/forward/reload` → 调用 `window.history.back() / .forward() / location.reload()`
- `goto` → 校验 url 合法（`/^https?:|^file:|^ftp:/`），不合法报错；通过 `location.assign(url)` 跳转
- 都返回 `{ ok: true, action }`；`goto` 返回 `{ ok: true, action: 'goto', url }`
- **不**阻塞等待新页面 load（content script 在导航时被销毁，强行 await 会卡死）；后续操作由 LLM 自己用 `waitFor` 兜

**Severity**：`back/forward/reload` → SAFE；`goto` → CAUTION（在 `classifyTool` 里按 `input.action` 二分）

### 3.2 `getPageInfo`

content-script 路径，纯读。

```ts
{
  name: "getPageInfo",
  description:
    "[FAST·READ] 读当前页基本信息：URL / title / hostname / 语言 / OpenGraph meta。\n" +
    "多页对话的「我在哪个页面」首选。比 snapshotDOM 便宜得多。",
  input_schema: {
    type: "object",
    properties: { tabId: TAB_ID_FIELD }
  }
}
```

返回：

```ts
{
  url: string,
  title: string,
  hostname: string,
  lang: string | null,        // <html lang>
  description: string | null, // <meta name="description">
  ogMeta: Record<string, string>  // og:title / og:type / og:image / og:url 等
}
```

实现：直接读 `location` / `document.title` / `document.documentElement.lang` / `<meta>` 节点。不超 1 KB。

**Severity**：SAFE

### 3.3 `pressKey`

content-script 路径。

```ts
{
  name: "pressKey",
  description:
    "[ACT] 模拟键盘事件。常用：Enter 提交搜索框（无 form 包裹时 submitForm 不适用）/ Escape 关 modal / Tab 切焦点。\n" +
    "key 用 [KeyboardEvent.key](https://developer.mozilla.org/docs/Web/API/UI_Events/Keyboard_event_key_values) 的值。\n" +
    "示例：\n" +
    "- 提交搜索：{ selector: 'input[name=q]', key: 'Enter' }\n" +
    "- 关 modal：{ key: 'Escape' }",
  input_schema: {
    type: "object",
    properties: {
      key: { type: "string", description: "如 'Enter' / 'Escape' / 'Tab' / 'ArrowDown' / 'a'" },
      selector: { type: "string", description: "可选；不传则派发到 document.activeElement 或 document.body" },
      tabId: TAB_ID_FIELD
    },
    required: ["key"]
  }
}
```

实现：

- 解析 selector（若给）→ 调用 `el.focus()` → 派发 `keydown` + `keypress`（仅对可打印字符）+ `keyup` 三个事件
- 事件用 `new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true })`；`code` 由 `key` 推导（"Enter" → "Enter"，"a" → "KeyA"，未知则同 key）
- 不模拟 `input` 事件——`fillInput` / `fillByUid` 才负责值变更
- 返回 `{ ok: true, key, dispatched: true }`

**Severity**：CAUTION（可能触发表单提交 / handler 副作用）

### 3.4 `writeStorage`

content-script 路径，对应已有 `readStorage`。

```ts
{
  name: "writeStorage",
  description: "[DANGER] 写 localStorage 或 sessionStorage。需要审阅。",
  input_schema: {
    type: "object",
    properties: {
      store: { type: "string", enum: ["local", "session"] },
      key: { type: "string" },
      value: { type: "string", description: "字符串值；非字符串请自行 JSON.stringify" },
      tabId: TAB_ID_FIELD
    },
    required: ["store", "key", "value"]
  }
}
```

实现：直接 `localStorage.setItem` / `sessionStorage.setItem`，返回 `{ ok: true, store, key }`。

**Severity**：DANGEROUS（与 `readStorage` 同级；改站点状态）

## 4 · 文件改动清单

**新增：**

```
packages/extension/src/content/tools/navigate.ts
packages/extension/src/content/tools/get-page-info.ts
packages/extension/src/content/tools/press-key.ts
packages/extension/src/content/tools/write-storage.ts
packages/extension/tests/content/tools/navigate.test.ts
packages/extension/tests/content/tools/get-page-info.test.ts
packages/extension/tests/content/tools/press-key.test.ts
packages/extension/tests/content/tools/write-storage.test.ts
```

**修改：**

- `packages/shared/src/types.ts` — `BuiltinTool` 加 4 个名
- `packages/extension/src/content/tools/index.ts` — 注册 4 个工具到 `TOOLS` map
- `packages/shared/src/llm/builtin-tool-defs.ts` — 4 个 schema + 描述（按 3.x 节）
- `packages/extension/src/sidepanel/chat/severity.ts` — `getPageInfo` 进 `SAFE`；`pressKey` 进 `CAUTION`；`writeStorage` 进 `DANGEROUS_FIXED`；`navigate` 走 `classifyTool` 内分支（按 `input.action`）

## 5 · ReplayableTool

4 个工具**全部 replayable**——都是确定性内容/状态变更，无人工 gesture 依赖。`ReplayableTool` 类型 `Exclude<>` 不动。

## 6 · 测试

每个工具一个 vitest 用例文件，模式照搬已有 `read-storage.test.ts` / `submit-form.test.ts`：

- `navigate.test.ts`：mock `history.back/forward/`、`location.reload/.assign`，断言 3 个分支调用 + url 非法时抛错
- `get-page-info.test.ts`：JSDOM 构造 head meta，断言返回结构 + null 字段
- `press-key.test.ts`：注册 keydown listener 验证 key / target，selector 命中 / 未命中 / 缺省 3 路径
- `write-storage.test.ts`：JSDOM Storage 验证 set 结果 + store 二选一

不写 e2e（已有 wire-integration 测试已经覆盖了 content-script ↔ background 的链路）。

## 7 · State 变化

- `severity.ts`：
  - `SAFE` 加 `getPageInfo`
  - `CAUTION` 加 `pressKey`
  - `DANGEROUS_FIXED` 加 `writeStorage`
  - `classifyTool` 在 `name === "navigate"` 时：`input.action ∈ {back, forward, reload}` → `safe`；否则 `caution`
- `BuiltinTool` 加 4 项
- `ReplayableTool` 不动

## 8 · 风险

| 风险 | 缓解 |
|---|---|
| `navigate goto` 跳到 `javascript:` / `data:` URL | URL 校验只允许 `http(s)/file/ftp`，与 `openTabRpc` 一致 |
| `pressKey` 误触发提交破坏页面 | severity = CAUTION，default 模式仍需用户审批；description 明示典型用法 |
| `writeStorage` 改站点登录态 / 偏好 | severity = DANGEROUS，仅 yolo / trust 自动放行；description 明示 |
| `getPageInfo` 返回过大 og:image base64 | 不读 `<link rel=icon>` 数据；ogMeta 只取 string 值，长度 cap 200 字符 |
| `navigate` 后 content script 销毁 | 不等 load；返回值表示「指令已派发」而非「页面已就绪」 |

## 9 · Out of scope

- 修改 `system-prompt.ts`（沿用既有 ReAct 模板；新工具靠自身 description 即可被 LLM 发现）
- `copyToClipboard` / `getCookies` / `setCookies` / `mouseClick(x,y)` / `dispatchEvent`
- 给 `navigate` 加 `waitForLoad` 行为（让 LLM 用 `waitFor` 自己等）
- 提交后 5 分钟内的发版（按既有 ship-release 流程）
