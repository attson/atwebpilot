<!-- ⚠ 自动生成 —— 修改源在 packages/shared/src/llm/builtin-tool-defs.ts；跑 `pnpm gen` 重生 -->


# 元 / 视觉工具

跨 tab、书签、历史、下载、截图、视觉高亮、征询用户。用于任务编排。

## `listTabs`  🟡 caution

[META] 列出所有窗口的可访问 tab；返回 [{tabId, windowId, url, title, attached, isCurrent}]。
在你需要识别 / 找新 tab 时调用。

**参数：**

| 字段 | 类型 | 说明 | 必填 |
|---|---|---|---|
| `windowId` | integer | 仅返回此窗口的 tab；省略=全部窗口 | 否 |

---

## `openTab`  🟡 caution

[META] 打开新 tab，成功后自动加入会话 attachedTabs（source=ai-open）。返回 {tabId, url, title}。

**参数：**

| 字段 | 类型 | 说明 | 必填 |
|---|---|---|---|
| `url` | string |  | 是 |
| `active` | boolean | true=切到该 tab | 否 |

---

## `attachTab`  🟡 caution

[META] 请求把已打开的 tab 纳入会话 attachedTabs；未预批准时会向用户索取审批。

**参数：**

| 字段 | 类型 | 说明 | 必填 |
|---|---|---|---|
| `tabId` | integer |  | 是 |
| `reason` | string | 向用户解释为何需要访问该 tab | 否 |

---

## `detachTab`  🟢 safe

[META] 从会话 attachedTabs 移除 tab；不关闭该 tab。

**参数：**

| 字段 | 类型 | 说明 | 必填 |
|---|---|---|---|
| `tabId` | integer |  | 是 |

---

## `closeTab`  🟢 safe

[META] 真正关闭一个 tab。**只能关 attachedTabs 里的 tab**（防止误关用户其它窗口）。

**参数：**

| 字段 | 类型 | 说明 | 必填 |
|---|---|---|---|
| `tabId` | integer |  | 是 |

---

## `switchToTab`  🟢 safe

[META] 把 Chrome 前台切到目标 tab。tabId 必须已在 attachedTabs 或当前 tab。

**参数：**

| 字段 | 类型 | 说明 | 必填 |
|---|---|---|---|
| `tabId` | integer |  | 是 |

---

## `screenshot`  🟢 safe

[VISION] 截当前 tab 可见区域为 PNG（自动作为 image block 注入下轮）。用于视觉调试 selector / 看图回答 / 留证据。返回 {ok: true, byteLen}。

**参数：**

| 字段 | 类型 | 说明 | 必填 |
|---|---|---|---|
| `selector` | string | 可选：CSS selector。基础版无视，始终截 viewport。 | 否 |
| `tabId` | integer | 目标 tab。要操作主会话 tab 时整个字段不要带（不要 0 / null）；要操作其它 tab 时它必须先在 attachedTabs（用 attachTab 申请） | 否 |

---

## `askUser`  🟢 safe

[ASK] 向用户主动征询（不是执行操作）。任务有多个候选 / 二次确认 / 缺关键信息时调用。返回 {choice} / {value} / {cancelled:true}。
**仅在你确实卡住时才用**——别用它做闲聊。

**参数：**

| 字段 | 类型 | 说明 | 必填 |
|---|---|---|---|
| `prompt` | string | 向用户展示的问题文本 | 是 |
| `kind` | string | select=用户从 options 选一项；confirm=是/否；text=自由文本 | 是 |
| `options` | array | kind=select 时必填，每项 {id, label, description?} | 否 |

---

## `searchBookmarks`  🟢 safe

[META] 搜索浏览器书签（chrome.bookmarks.search）。返回 [{id, title, url}]。

示例：{ query: 'react', limit: 20 }

**参数：**

| 字段 | 类型 | 说明 | 必填 |
|---|---|---|---|
| `query` | string |  | 是 |
| `limit` | integer |  | 否 |

---

## `searchHistory`  🟢 safe

[META] 搜索浏览器历史。daysBack 默认 7。返回 [{url, title, lastVisitTime, visitCount}]。

**参数：**

| 字段 | 类型 | 说明 | 必填 |
|---|---|---|---|
| `query` | string |  | 是 |
| `daysBack` | integer |  | 否 |
| `limit` | integer |  | 否 |

---

## `downloadImage`  🟡 caution

[ACT] 把一个 URL 下载到本地（Chrome Downloads）。返回 {downloadId, filename}。caution 级。

**参数：**

| 字段 | 类型 | 说明 | 必填 |
|---|---|---|---|
| `url` | string |  | 是 |
| `filename` | string | 可选：建议的文件名（含后缀） | 否 |

---

## `highlightElement`  🟢 safe

[VISUAL] 给页面某元素加红色虚线框（默认 3s 自动消失），让用户看清你说的是哪个。仅视觉，不改 DOM。
可用 selector 或 uid 任一种。

**参数：**

| 字段 | 类型 | 说明 | 必填 |
|---|---|---|---|
| `selector` | string |  | 否 |
| `uid` | string | 或 takeSnapshot 返回的 uid | 否 |
| `ms` | integer |  | 否 |
| `tabId` | integer | 目标 tab。要操作主会话 tab 时整个字段不要带（不要 0 / null）；要操作其它 tab 时它必须先在 attachedTabs（用 attachTab 申请） | 否 |

---

## `highlightText`  🟢 safe

[VISUAL] 在页面文本里高亮某段文字（黄色背景，3s 后还原）。仅找到第一次出现的位置。

**参数：**

| 字段 | 类型 | 说明 | 必填 |
|---|---|---|---|
| `text` | string |  | 是 |
| `ms` | integer |  | 否 |
| `tabId` | integer | 目标 tab。要操作主会话 tab 时整个字段不要带（不要 0 / null）；要操作其它 tab 时它必须先在 attachedTabs（用 attachTab 申请） | 否 |

---
