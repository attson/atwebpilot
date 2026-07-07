// packages/shared/src/presets/ecommerce/taobao.ts
import type { Preset } from "../../preset";

export const taobaoItemCollect: Preset = {
  id: "taobao-item-collect",
  name: "淘宝商品采集",
  description: "主图 + 参数 + 前 30 评论(反爬严重,可能失败,自愈会尝试重生成)",
  category: "ecommerce",
  urlPatterns: ["https://item.taobao.com/**"],
  version: 1,
  sampleUrl: "https://item.taobao.com/item.htm?id=demo",
  kind: "tool",
  steps: [
    { kind: "tool", tool: "waitFor", args: { selector: "body", timeoutMs: 3000 } },
    { kind: "tool", tool: "extractImages", args: {}, bindResultTo: "images" },
    { kind: "tool", tool: "extractText", args: {}, bindResultTo: "text" },
    { kind: "tool", tool: "snapshotDOM", args: { depth: 5 }, bindResultTo: "dom" }
  ]
};
