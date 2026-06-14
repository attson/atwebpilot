import type { LlmTool } from "./types";

/**
 * Shared description for the `tabId` field — used by every page-level tool.
 * Centralized so updates to the cross-tab protocol propagate everywhere.
 */
const TAB_ID_FIELD = {
  type: "integer" as const,
  description:
    "目标 tab。要操作主会话 tab 时整个字段不要带（不要 0 / null）；要操作其它 tab 时它必须先在 attachedTabs（用 attachTab 申请）",
};

export const TOOL_DEFS: LlmTool[] = [
  {
    name: "snapshotDOM",
    description:
      "[FIRST·LEGACY] 返回页面 DOM 简化树（tag/id/classes/直接文本/children）。\n" +
      "如果你只是要找交互元素并随后操作，**优先用 takeSnapshot**（UID 稳定，clickByUid 健壮）；\n" +
      "snapshotDOM 更适合「我要分析整个页面结构」这种探查类需求。\n\n" +
      "示例：\n" +
      "- 看整页：{ }（默认 maxDepth=3）\n" +
      "- 看某区域：{ root: '.main-content', maxDepth: 5 }\n" +
      "- 看到底：{ maxDepth: 8 }",
    input_schema: {
      type: "object",
      properties: {
        maxDepth: { type: "integer", default: 3 },
        root: { type: "string", description: "可选的 CSS 选择器；找不到时退回到 <html>" },
        tabId: TAB_ID_FIELD,
      },
    },
  },
  {
    name: "querySelector",
    description:
      "[FAST] 返回首个匹配元素的浅层摘要 (tag/id/classes/text/attrs)。仅探查用。\n" +
      "要后续点击或填值，配合 selector 直接传给 click / fillInput，或用 takeSnapshot 拿 UID。\n\n" +
      "示例：\n" +
      "- 找按钮：{ selector: 'button[type=submit]' }\n" +
      "- 找输入：{ selector: 'input[name=email]' }",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        root: { type: "string" },
        tabId: TAB_ID_FIELD,
      },
      required: ["selector"],
    },
  },
  {
    name: "querySelectorAll",
    description:
      "[FAST] 返回所有匹配元素的浅层摘要数组。\n\n" +
      "示例：\n" +
      "- 所有评论：{ selector: '.comment-item', limit: 50 }\n" +
      "- 所有链接：{ selector: 'a[href]', limit: 20 }",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        root: { type: "string" },
        limit: { type: "integer" },
        tabId: TAB_ID_FIELD,
      },
      required: ["selector"],
    },
  },
  {
    name: "extractText",
    description:
      "[FAST] 提取选择器命中元素的文本。single=true 返回字符串，否则返回数组。\n\n" +
      "示例：\n" +
      "- 提取标题：{ selector: 'h1', single: true }\n" +
      "- 提取所有段落：{ selector: 'article p' }",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        root: { type: "string" },
        single: { type: "boolean" },
        tabId: TAB_ID_FIELD,
      },
      required: ["selector"],
    },
  },
  {
    name: "extractImages",
    description:
      "[FAST] 在 root 范围内提取所有 <img> 的 src/data-src/srcset；includeBg=true 时也提取背景图。返回 [{url, via}].\n\n" +
      "示例：\n" +
      "- 全页图：{ }（默认 root=document）\n" +
      "- 商品主图：{ root: '.product-gallery' }",
    input_schema: {
      type: "object",
      properties: {
        root: { type: "string" },
        includeBg: { type: "boolean", default: false },
        tabId: TAB_ID_FIELD,
      },
    },
  },
  {
    name: "scroll",
    description:
      "[FLOW] 滚动页面。to 可为 'bottom' / 'top' / number。max 是滚动次数；untilSelector 出现时提前停。\n\n" +
      "示例：\n" +
      "- 触发懒加载：{ to: 'bottom', max: 5 }\n" +
      "- 滚到锚点：{ to: 'top' } 后用 element.scrollIntoView 也可\n" +
      "- 等待新元素：{ to: 'bottom', max: 10, untilSelector: '.item:nth-child(20)' }",
    input_schema: {
      type: "object",
      properties: {
        to: { description: "'bottom' | 'top' | number" },
        max: { type: "integer", default: 1 },
        intervalMs: { type: "integer", default: 250 },
        untilSelector: { type: "string" },
        tabId: TAB_ID_FIELD,
      },
      required: ["to"],
    },
  },
  {
    name: "waitFor",
    description:
      "[FLOW] 等待固定 ms，或等待选择器出现（带 timeoutMs 兜底）。\n\n" +
      "示例：\n" +
      "- 等 500ms：{ ms: 500 }\n" +
      "- 等元素出现：{ selector: '.lazy-loaded', timeoutMs: 8000 }",
    input_schema: {
      type: "object",
      properties: {
        ms: { type: "integer" },
        selector: { type: "string" },
        timeoutMs: { type: "integer", default: 5000 },
        tabId: TAB_ID_FIELD,
      },
    },
  },
  {
    name: "click",
    description:
      "[ACT] 点击选择器命中的元素。required=false 时找不到不报错。会经过审阅（caution）。\n" +
      "用 takeSnapshot 拿到 UID 后建议改用 clickByUid，更稳。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        required: { type: "boolean", default: true },
        tabId: TAB_ID_FIELD,
      },
      required: ["selector"],
    },
  },
  {
    name: "httpRequest",
    description:
      "[ACT] 通过后台代理发请求。withCredentials=true 时带 cookie（dangerous，要审阅）；默认 omit。\n\n" +
      "示例：\n" +
      "- 翻评论页：{ url: 'https://x.com/api/comments?page=2', withCredentials: false }\n" +
      "- 带登录态调内部接口：{ url: '...', withCredentials: true }",
    input_schema: {
      type: "object",
      properties: {
        method: { type: "string", default: "GET" },
        url: { type: "string" },
        headers: { type: "object" },
        body: { description: "any JSON-able value" },
        withCredentials: { type: "boolean", default: false },
        tabId: TAB_ID_FIELD,
      },
      required: ["url"],
    },
  },
  {
    name: "readStorage",
    description: "[DANGER] 读 localStorage 或 sessionStorage 指定 key。需要审阅。",
    input_schema: {
      type: "object",
      properties: {
        store: { type: "string", enum: ["local", "session"] },
        key: { type: "string" },
        tabId: TAB_ID_FIELD,
      },
      required: ["store", "key"],
    },
  },
  {
    name: "fillInput",
    description:
      "[ACT] 往 input/textarea/contenteditable 填值；触发 input/change 事件兼容 React/Vue。\n" +
      "**批量填表请用 fillForm**（更高效）。\n\n" +
      "示例：\n" +
      "- 填邮箱：{ selector: 'input[name=email]', value: 'a@b.c' }\n" +
      "- 不清空直接追加：{ selector: '.editor', value: 'tail', clear: false }",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        value: { type: "string" },
        clear: { type: "boolean", default: true },
        tabId: TAB_ID_FIELD,
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "setCheckbox",
    description: "[ACT] 设置 checkbox 勾选状态；派发 change 事件。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        checked: { type: "boolean" },
        tabId: TAB_ID_FIELD,
      },
      required: ["selector", "checked"],
    },
  },
  {
    name: "selectOption",
    description: "[ACT] <select> 元素按 value 或 label 选项。同时给两者时优先 value。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        value: { type: "string" },
        label: { type: "string" },
        tabId: TAB_ID_FIELD,
      },
      required: ["selector"],
    },
  },
  {
    name: "submitForm",
    description:
      "[CONFIRM·DANGER] 提交 <form>。会触发服务端动作（下单、留言等），用户必须审阅。\n" +
      "调用前建议先用 askUser 让用户最终确认。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        tabId: TAB_ID_FIELD,
      },
      required: ["selector"],
    },
  },
  {
    name: "hover",
    description: "[ACT] 把鼠标悬停在元素上（触发 mouseenter / mouseover / mousemove）。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        tabId: TAB_ID_FIELD,
      },
      required: ["selector"],
    },
  },
  {
    name: "focus",
    description: "[ACT] 把焦点给某元素（触发 focus / focusin）。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        tabId: TAB_ID_FIELD,
      },
      required: ["selector"],
    },
  },
  {
    name: "uploadFile",
    description:
      "[CONFIRM·DANGER] 把后端代理拉到的文件填到 <input type=file>。某些站点会拒绝合成 File。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        url: { type: "string" },
        filename: { type: "string" },
        mimeType: { type: "string" },
        tabId: TAB_ID_FIELD,
      },
      required: ["selector", "url"],
    },
  },
  {
    name: "getValue",
    description: "[FAST] 读 input/select/textarea/contenteditable 的当前值。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        tabId: TAB_ID_FIELD,
      },
      required: ["selector"],
    },
  },
  {
    name: "extractFormState",
    description:
      "[FAST·USE BEFORE FILL] 把 <form> 内所有可填字段读成 {name: value} 对象（radio 取选中值；checkbox 多选取数组）。\n" +
      "填表前先调一次，能省下大量盲填。",
    input_schema: {
      type: "object",
      properties: {
        form: { type: "string", description: "可选：<form> 的 CSS selector；省略=第一个 form" },
        tabId: TAB_ID_FIELD,
      },
    },
  },
  {
    name: "runJS",
    description:
      "[LAST RESORT·DANGER] 在 MAIN world 注入并执行 async 函数体（receives `ctx` = bindings）。必须 return 值。\n" +
      "**仅在结构化工具不够用时使用**——会经过静态扫描与人工审阅。",
    input_schema: {
      type: "object",
      properties: {
        source: { type: "string", description: "async function body" },
        tabId: TAB_ID_FIELD,
      },
      required: ["source"],
    },
  },
  // ─── Cross-tab control plane ─────────────────────────────────
  {
    name: "listTabs",
    description:
      "[META] 列出所有窗口的可访问 tab；返回 [{tabId, windowId, url, title, attached, isCurrent}]。\n" +
      "在你需要识别 / 找新 tab 时调用。",
    input_schema: {
      type: "object",
      properties: {
        windowId: { type: "integer", description: "仅返回此窗口的 tab；省略=全部窗口" },
      },
    },
  },
  {
    name: "openTab",
    description: "[META] 打开新 tab，成功后自动加入会话 attachedTabs（source=ai-open）。返回 {tabId, url, title}。",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string" },
        active: { type: "boolean", default: false, description: "true=切到该 tab" },
      },
      required: ["url"],
    },
  },
  {
    name: "attachTab",
    description: "[META] 请求把已打开的 tab 纳入会话 attachedTabs；未预批准时会向用户索取审批。",
    input_schema: {
      type: "object",
      properties: {
        tabId: { type: "integer" },
        reason: { type: "string", description: "向用户解释为何需要访问该 tab" },
      },
      required: ["tabId"],
    },
  },
  {
    name: "detachTab",
    description: "[META] 从会话 attachedTabs 移除 tab；不关闭该 tab。",
    input_schema: {
      type: "object",
      properties: { tabId: { type: "integer" } },
      required: ["tabId"],
    },
  },
  {
    name: "closeTab",
    description:
      "[META] 真正关闭一个 tab。**只能关 attachedTabs 里的 tab**（防止误关用户其它窗口）。",
    input_schema: {
      type: "object",
      properties: { tabId: { type: "integer" } },
      required: ["tabId"],
    },
  },
  {
    name: "switchToTab",
    description: "[META] 把 Chrome 前台切到目标 tab。tabId 必须已在 attachedTabs 或当前 tab。",
    input_schema: {
      type: "object",
      properties: { tabId: { type: "integer" } },
      required: ["tabId"],
    },
  },
  // ─── User-side helpers ───────────────────────────────────────
  {
    name: "screenshot",
    description:
      "[VISION] 截当前 tab 可见区域为 PNG（自动作为 image block 注入下轮）。用于视觉调试 selector / 看图回答 / 留证据。返回 {ok: true, byteLen}。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "可选：CSS selector。基础版无视，始终截 viewport。" },
        tabId: TAB_ID_FIELD,
      },
    },
  },
  {
    name: "askUser",
    description:
      "[ASK] 向用户主动征询（不是执行操作）。任务有多个候选 / 二次确认 / 缺关键信息时调用。返回 {choice} / {value} / {cancelled:true}。\n" +
      "**仅在你确实卡住时才用**——别用它做闲聊。",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "向用户展示的问题文本" },
        kind: {
          type: "string",
          enum: ["select", "confirm", "text"],
          description: "select=用户从 options 选一项；confirm=是/否；text=自由文本",
        },
        options: {
          type: "array",
          description: "kind=select 时必填，每项 {id, label, description?}",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              description: { type: "string" },
            },
            required: ["id", "label"],
          },
        },
      },
      required: ["prompt", "kind"],
    },
  },
  // ─── Tier 3 · bookmark / history / downloads ────────────────
  {
    name: "searchBookmarks",
    description: "[META] 搜索浏览器书签（chrome.bookmarks.search）。返回 [{id, title, url}]。\n\n示例：{ query: 'react', limit: 20 }",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer", default: 50 },
      },
      required: ["query"],
    },
  },
  {
    name: "searchHistory",
    description: "[META] 搜索浏览器历史。daysBack 默认 7。返回 [{url, title, lastVisitTime, visitCount}]。",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        daysBack: { type: "integer", default: 7 },
        limit: { type: "integer", default: 50 },
      },
      required: ["query"],
    },
  },
  {
    name: "downloadImage",
    description: "[ACT] 把一个 URL 下载到本地（Chrome Downloads）。返回 {downloadId, filename}。caution 级。",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string" },
        filename: { type: "string", description: "可选：建议的文件名（含后缀）" },
      },
      required: ["url"],
    },
  },
  // ─── Tier 4 · UID-based interaction + visual + batch ────────
  {
    name: "takeSnapshot",
    description:
      "[FIRST·UID] 抓取页面 accessibility snapshot：返回 [{uid, role, name, tag, text, bounds}]。\n" +
      "UID 在本次 snapshot 内稳定，后续 clickByUid / fillByUid 引用；比 selector 健壮，不怕 class 改名。\n" +
      "每次大动作前刷新一次。snapshot 默认只返回交互元素（button / link / input / textarea / select / [role] / [data-testid]）。",
    input_schema: {
      type: "object",
      properties: {
        includeAll: { type: "boolean", default: false, description: "true=全部 element；false=只 interactive（默认）" },
        tabId: TAB_ID_FIELD,
      },
    },
  },
  {
    name: "clickByUid",
    description: "[ACT·UID] 用 takeSnapshot 返回的 uid 点击元素。比 selector 版稳定。",
    input_schema: {
      type: "object",
      properties: {
        uid: { type: "string" },
        tabId: TAB_ID_FIELD,
      },
      required: ["uid"],
    },
  },
  {
    name: "fillByUid",
    description: "[ACT·UID] 用 takeSnapshot 返回的 uid 填值（input/textarea/contenteditable）。",
    input_schema: {
      type: "object",
      properties: {
        uid: { type: "string" },
        value: { type: "string" },
        clear: { type: "boolean", default: true },
        tabId: TAB_ID_FIELD,
      },
      required: ["uid", "value"],
    },
  },
  {
    name: "highlightElement",
    description:
      "[VISUAL] 给页面某元素加红色虚线框（默认 3s 自动消失），让用户看清你说的是哪个。仅视觉，不改 DOM。\n" +
      "可用 selector 或 uid 任一种。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        uid: { type: "string", description: "或 takeSnapshot 返回的 uid" },
        ms: { type: "integer", default: 3000 },
        tabId: TAB_ID_FIELD,
      },
    },
  },
  {
    name: "highlightText",
    description: "[VISUAL] 在页面文本里高亮某段文字（黄色背景，3s 后还原）。仅找到第一次出现的位置。",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string" },
        ms: { type: "integer", default: 3000 },
        tabId: TAB_ID_FIELD,
      },
      required: ["text"],
    },
  },
  {
    name: "fillForm",
    description:
      "[BATCH·ACT] 一次性填多个字段。每项写 selector + value 或 uid + value。返回 {filled: N, failed: [{at, error}]}。\n" +
      "比循环调 fillInput 快得多，也省 round-trip。\n\n" +
      "示例：\n" +
      "{ fields: [\n" +
      "  { selector: 'input[name=name]', value: '张三' },\n" +
      "  { selector: 'input[name=phone]', value: '13800000000' },\n" +
      "  { uid: 'el_5', value: 'mushroom' }\n" +
      "] }",
    input_schema: {
      type: "object",
      properties: {
        fields: {
          type: "array",
          items: {
            type: "object",
            properties: {
              selector: { type: "string" },
              uid: { type: "string" },
              value: { type: "string" },
            },
            required: ["value"],
          },
        },
        tabId: TAB_ID_FIELD,
      },
      required: ["fields"],
    },
  },
];
