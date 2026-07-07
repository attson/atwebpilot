// packages/shared/src/presets/content/wechat-mp.ts
import type { Preset } from "../../preset";

export const wechatMpSummary: Preset = {
  id: "wechat-mp-summary",
  name: "公众号文章总结",
  description: "要点 + 人物 / 数据 / 链接",
  category: "content",
  urlPatterns: ["https://mp.weixin.qq.com/s/**", "https://mp.weixin.qq.com/s?**"],
  version: 1,
  kind: "prompt",
  prompt:
    "总结这篇公众号文章:\n" +
    "1) 文章要点(3-5 条)\n" +
    "2) 提到的关键人物 / 机构\n" +
    "3) 出现的数据 / 事实\n" +
    "4) 外部链接列表\n" +
    "用 extractText + extractImages(可选)。"
};
