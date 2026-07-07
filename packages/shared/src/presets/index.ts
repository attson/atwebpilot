// packages/shared/src/presets/index.ts
import type { Preset } from "../preset";
import { wikipediaSummary } from "./content/wikipedia";
import { githubRepoBrief } from "./content/github-repo";
import { githubIssueDigest } from "./content/github-issue";
import { mediumArticleTldr } from "./content/medium";
import { zhihuQuestionSummary } from "./content/zhihu";
import { wechatMpSummary } from "./content/wechat-mp";
import { articleTranslateZh } from "./content/article-translate";

export const PRESETS: readonly Preset[] = Object.freeze([
  wikipediaSummary,
  githubRepoBrief,
  githubIssueDigest,
  mediumArticleTldr,
  zhihuQuestionSummary,
  wechatMpSummary,
  articleTranslateZh
]);
