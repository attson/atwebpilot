/**
 * 5 dangerous-by-default tools surfaced in the "信任白名单" mode and
 * the Settings → 权限默认值 section.
 *
 * `id` must match the value `evaluateAutoApproval` sees when comparing
 * with `trustedDangerTools[]`.
 */
export const DANGEROUS_TOOLS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "submitForm",      label: "submitForm — 提交表单" },
  { id: "uploadFile",      label: "uploadFile — 上传文件" },
  { id: "readStorage",     label: "readStorage — 读 localStorage / sessionStorage" },
  { id: "httpRequest",     label: "httpRequest 带 cookie" },
  { id: "runJS",           label: "runJS — 包含 cookie/eval/storage 的脚本" },
];

export const DANGEROUS_TOOL_TOTAL = DANGEROUS_TOOLS.length;
