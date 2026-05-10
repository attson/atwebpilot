import type { LlmTool } from "./types";

export const TOOL_DEFS: LlmTool[] = [
  {
    name: "snapshotDOM",
    description: "页面 DOM 摘要：返回从 root 开始的简化树，含 tag/id/classes/直接文本/children。优先在每次任务开始用一次以了解结构。",
    input_schema: {
      type: "object",
      properties: {
        maxDepth: { type: "integer", default: 3 },
        root: { type: "string", description: "可选的 CSS 选择器；找不到时退回到 <html>" }
      }
    }
  },
  {
    name: "querySelector",
    description: "返回首个匹配元素的浅层摘要 (tag/id/classes/text/attrs)。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        root: { type: "string" }
      },
      required: ["selector"]
    }
  },
  {
    name: "querySelectorAll",
    description: "返回所有匹配元素的浅层摘要数组。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        root: { type: "string" },
        limit: { type: "integer" }
      },
      required: ["selector"]
    }
  },
  {
    name: "extractText",
    description: "提取选择器命中的元素文本。single=true 返回一个字符串，否则返回数组。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        root: { type: "string" },
        single: { type: "boolean" }
      },
      required: ["selector"]
    }
  },
  {
    name: "extractImages",
    description: "在 root 范围内提取所有 <img> 的 src/data-src/srcset；includeBg=true 时也提取背景图。返回 {url, via}[].",
    input_schema: {
      type: "object",
      properties: {
        root: { type: "string" },
        includeBg: { type: "boolean", default: false }
      }
    }
  },
  {
    name: "scroll",
    description: "滚动页面。to 可为 'bottom'|'top'|number；max 是滚动次数；untilSelector 出现时提前停。",
    input_schema: {
      type: "object",
      properties: {
        to: { description: "'bottom' | 'top' | number" },
        max: { type: "integer", default: 1 },
        intervalMs: { type: "integer", default: 250 },
        untilSelector: { type: "string" }
      },
      required: ["to"]
    }
  },
  {
    name: "waitFor",
    description: "等待固定 ms，或等待选择器出现（带 timeoutMs 兜底）。",
    input_schema: {
      type: "object",
      properties: {
        ms: { type: "integer" },
        selector: { type: "string" },
        timeoutMs: { type: "integer", default: 5000 }
      }
    }
  },
  {
    name: "click",
    description: "点击选择器命中的元素。required=false 时找不到不报错。需要人工审阅。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        required: { type: "boolean", default: true }
      },
      required: ["selector"]
    }
  },
  {
    name: "httpRequest",
    description: "通过后台代理发请求。withCredentials=true 时带 cookie，需要人工审阅；默认 omit。",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string" },
        method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"], default: "GET" },
        headers: { type: "object" },
        body: { type: "string" },
        withCredentials: { type: "boolean", default: false }
      },
      required: ["url"]
    }
  },
  {
    name: "readStorage",
    description: "读 localStorage 或 sessionStorage 的指定 key。需要人工审阅。",
    input_schema: {
      type: "object",
      properties: {
        store: { type: "string", enum: ["local", "session"] },
        key: { type: "string" }
      },
      required: ["store", "key"]
    }
  },
  {
    name: "fillInput",
    description: "往 input/textarea/contenteditable 填值；触发 input/change 事件以兼容 React/Vue。clear=true（默认）会先清空再填。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        value: { type: "string" },
        clear: { type: "boolean", default: true }
      },
      required: ["selector", "value"]
    }
  },
  {
    name: "setCheckbox",
    description: "设置 checkbox 勾选状态；派发 change 事件。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        checked: { type: "boolean" }
      },
      required: ["selector", "checked"]
    }
  },
  {
    name: "selectOption",
    description: "<select> 元素按 value 或 label 选项。同时给两者时优先 value。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        value: { type: "string" },
        label: { type: "string" }
      },
      required: ["selector"]
    }
  },
  {
    name: "submitForm",
    description: "提交 <form>。会触发服务端动作（下单、留言等），需要审阅。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string", default: "form" }
      }
    }
  },
  {
    name: "hover",
    description: "把鼠标悬停在元素上（触发 mouseenter / mouseover / mousemove）。",
    input_schema: {
      type: "object",
      properties: { selector: { type: "string" } },
      required: ["selector"]
    }
  },
  {
    name: "focus",
    description: "把焦点给某元素（触发 focus / focusin）。",
    input_schema: {
      type: "object",
      properties: { selector: { type: "string" } },
      required: ["selector"]
    }
  },
  {
    name: "uploadFile",
    description: "把后端代理拉到的文件填到 <input type=file>。某些站点会拒绝合成 File（isTrusted 校验）。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        url: { type: "string" },
        filename: { type: "string" },
        mime: { type: "string" }
      },
      required: ["selector", "url"]
    }
  },
  {
    name: "getValue",
    description: "读 input/select/textarea/contenteditable 的当前值。",
    input_schema: {
      type: "object",
      properties: { selector: { type: "string" } },
      required: ["selector"]
    }
  },
  {
    name: "extractFormState",
    description: "把 <form> 内所有可填字段读成 {name: value} 对象（radio 取选中值；checkbox 多选取数组）。",
    input_schema: {
      type: "object",
      properties: { selector: { type: "string", default: "form" } }
    }
  },
  {
    name: "runJS",
    description: "在 MAIN world 注入并执行一段 async 函数体（receives `ctx` = bindings）。务必使用 return 返回值。仅在结构化工具不够用时使用，会经过静态扫描与人工审阅。",
    input_schema: {
      type: "object",
      properties: {
        source: { type: "string", description: "async function body" }
      },
      required: ["source"]
    }
  }
];
