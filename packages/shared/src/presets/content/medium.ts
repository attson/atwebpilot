// packages/shared/src/presets/content/medium.ts
import type { Preset } from "../../preset";

export const mediumArticleTldr: Preset = {
  id: "medium-article-tldr",
  name: "Medium 文章要点",
  description: "5 条核心观点 + TL;DR",
  category: "content",
  urlPatterns: ["https://medium.com/**", "https://*.medium.com/**"],
  version: 1,
  kind: "prompt",
  prompt:
    "阅读当前 Medium 文章,输出:\n" +
    "1) 一句话 TL;DR\n" +
    "2) 5 条核心观点(带 1 句支撑)\n" +
    "3) 作者背景(如页面显示)\n" +
    "先 extractText,遇到墙则读可见部分。"
};
