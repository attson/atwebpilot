import type { HealContext } from "@/background/self-heal";

export function buildSelfHealMessages(
  ctx: HealContext,
  maxOutputTokens: number
): { system: string; user: string; maxTokens: number } {
  const prevSummary = ctx.prevSteps
    .slice(-5)
    .map((s, i) => `[${i}] input=${JSON.stringify(s.input).slice(0, 200)} output=${JSON.stringify(s.output).slice(0, 200)}`)
    .join("\n");

  const domStr = JSON.stringify(ctx.domSnapshot).slice(0, 8000);

  const system =
    "你在为一个可重放的浏览器自动化工具修复失败的 step。\n" +
    "给定原 steps、已成功产物、失败 step、错误信息、失败瞬间的 DOM 快照,\n" +
    "输出从失败 step 开始的补丁 Step[] 数组(JSON,不带 markdown fence)。\n" +
    "允许的 step kind: {snapshotDOM, querySelector, querySelectorAll, extractText, extractImages, scroll, waitFor, hover, focus, getValue, extractFormState, click, fillInput, setCheckbox, selectOption, httpRequest(不带 cookie), runJS(不含 storage/eval/cookies 等关键词)}。\n" +
    "禁止:submitForm, uploadFile, readStorage, httpRequest(withCredentials), runJS(含 eval/cookie/storage)。\n" +
    "补丁应尽量少改动、保持产物结构一致。只输出 JSON step 数组,不做解释。";

  const user =
    `- 原 tool: ${ctx.tool.name}, 共 ${ctx.tool.steps.length} 步\n` +
    `- 失败 step [${ctx.failedStepIndex}]: ${JSON.stringify(ctx.failedInput)}\n` +
    `- 错误: ${ctx.errorText}\n` +
    `- 当前 URL: ${ctx.url}\n` +
    `- 最近产物:\n${prevSummary}\n` +
    `- 当前 DOM(截断): ${domStr}\n`;

  return { system, user, maxTokens: Math.min(maxOutputTokens, 8192) };
}
