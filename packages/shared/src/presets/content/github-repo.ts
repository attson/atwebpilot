// packages/shared/src/presets/content/github-repo.ts
import type { Preset } from "../../preset";

export const githubRepoBrief: Preset = {
  id: "github-repo-brief",
  name: "GitHub 仓库摘要",
  description: "总结项目定位、用法、活跃度、关键 issue",
  category: "content",
  urlPatterns: ["https://github.com/*/*"],
  version: 1,
  kind: "prompt",
  prompt:
    "总结这个 GitHub 仓库:\n" +
    "1) 项目定位与解决的问题\n" +
    "2) 快速上手/用法(从 README 抽取)\n" +
    "3) 活跃度指标(最近 commit、star、open issue 数)\n" +
    "4) 3-5 个关键 issue 或讨论\n" +
    "用 snapshotDOM 拿页面结构,extractText 拿 README 主体。"
};
