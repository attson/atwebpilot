// packages/shared/src/presets/content/zhihu.ts
import type { Preset } from "../../preset";

export const zhihuQuestionSummary: Preset = {
  id: "zhihu-question-summary",
  name: "知乎问题摘要",
  description: "汇总高赞回答的共同观点与分歧",
  category: "content",
  urlPatterns: ["https://www.zhihu.com/question/**"],
  version: 1,
  kind: "prompt",
  prompt:
    "总结这个知乎问题:\n" +
    "1) 问题本身在问什么\n" +
    "2) 前 5 个高赞回答的观点归纳\n" +
    "3) 观点的共识与分歧\n" +
    "4) 主要论据/引用\n" +
    "先 scroll 一次触发懒加载,再 extractText 高赞区块。"
};
