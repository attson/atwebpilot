// packages/shared/src/presets/content/github-issue.ts
import type { Preset } from "../../preset";

export const githubIssueDigest: Preset = {
  id: "github-issue-digest",
  name: "GitHub Issue 摘要",
  description: "汇总讨论进展与共识",
  category: "content",
  urlPatterns: ["https://github.com/*/*/issues/**", "https://github.com/*/*/pull/**"],
  version: 1,
  kind: "prompt",
  prompt:
    "总结这条 issue/PR 的讨论:\n" +
    "1) 核心问题或提案\n" +
    "2) 讨论中出现的主要观点(按人物聚合)\n" +
    "3) 当前共识 / 分歧点 / 待定问题\n" +
    "4) 最新状态(open/closed/merged,最新 comment 时间)\n" +
    "先 scroll 到底加载全部,再 extractText。"
};
