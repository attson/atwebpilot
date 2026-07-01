/**
 * 中文别名表：工具名 → 一句话中文描述。
 * StepRow（简洁模式）优先显示中文别名；无别名的工具回退到英文原名。
 * 单测保证 key 都在 TOOL_DEFS 里（防止 rename 后残留）。
 */
export const TOOL_LABELS: Record<string, string> = {
  // Snapshot / query
  snapshotDOM: "抓 DOM 结构",
  takeSnapshot: "抓页面快照",
  querySelector: "找单个元素",
  querySelectorAll: "找匹配元素",
  extractText: "提取文本",
  extractImages: "提取图片",
  getPageInfo: "获取页面信息",
  getValue: "读取输入值",
  extractFormState: "读表单状态",

  // Flow
  scroll: "滚动页面",
  waitFor: "等待",
  navigate: "页面导航",

  // Actions
  click: "点击元素",
  clickByUid: "点击元素",
  fillInput: "填入值",
  fillByUid: "填入值",
  fillForm: "批量填表",
  setCheckbox: "勾选/取消",
  selectOption: "下拉选项",
  submitForm: "提交表单",
  hover: "悬停",
  focus: "聚焦",
  pressKey: "按键",
  uploadFile: "上传文件",

  // Storage / danger
  readStorage: "读 storage",
  writeStorage: "写 storage",
  httpRequest: "发请求",
  runJS: "执行脚本",

  // Cross-tab
  listTabs: "列出 tab",
  openTab: "开新 tab",
  attachTab: "挂载 tab",
  detachTab: "取消挂载",
  closeTab: "关闭 tab",
  switchToTab: "切换 tab",

  // Meta
  screenshot: "截图",
  askUser: "征求确认",
  searchBookmarks: "搜书签",
  searchHistory: "搜历史",
  downloadImage: "下载图片",

  // Visual
  highlightElement: "高亮元素",
  highlightText: "高亮文字",
};

export function labelFor(toolName: string): string | null {
  return TOOL_LABELS[toolName] ?? null;
}
