// packages/shared/src/presets/content/wikipedia.ts
import type { Preset } from "../../preset";

export const wikipediaSummary: Preset = {
  id: "wikipedia-summary",
  name: "维基百科总结",
  description: "用三段总结当前条目,并列出「参见」中的相关条目",
  category: "content",
  urlPatterns: ["https://*.wikipedia.org/**"],
  version: 1,
  kind: "prompt",
  prompt:
    "请阅读当前维基百科条目,输出:\n" +
    "1) 用三段话总结这个条目的核心内容(定义、历史脉络、当前状态)\n" +
    "2) 列出'参见/See also'区块里的相关条目\n" +
    "先用 snapshotDOM + extractText 拿到主要内容,再总结。"
};
