// packages/shared/src/presets/content/article-translate.ts
import type { Preset } from "../../preset";

// 通用 preset。URL 用宽松通配符——真正的"是不是长文"由用户点击时判断。
export const articleTranslateZh: Preset = {
  id: "article-translate-zh",
  name: "长文翻译为中文",
  description: "翻译当前文章为中文,保留段落结构",
  category: "content",
  urlPatterns: ["https://**"],
  version: 1,
  kind: "prompt",
  prompt:
    "翻译当前网页的主要文章内容为中文:\n" +
    "1) 保留原段落结构\n" +
    "2) 对标题层级用 markdown # ## ### 标注\n" +
    "3) 术语首次出现给出括号原文\n" +
    "先 extractText 拿正文再翻译。"
};
