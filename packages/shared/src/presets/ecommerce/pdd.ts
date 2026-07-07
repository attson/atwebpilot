// packages/shared/src/presets/ecommerce/pdd.ts
import type { Preset } from "../../preset";

export const pddGoodsCollect: Preset = {
  id: "pdd-goods-collect",
  name: "拼多多商品采集",
  description: "主图 + 详情图 + 前 50 评论",
  category: "ecommerce",
  urlPatterns: ["https://mobile.pinduoduo.com/goods.html?**"],
  version: 1,
  sampleUrl: "https://mobile.pinduoduo.com/goods.html?goods_id=demo",
  kind: "tool",
  steps: [
    { kind: "tool", tool: "waitFor", args: { selector: "body", timeoutMs: 3000 } },
    { kind: "tool", tool: "extractImages", args: {}, bindResultTo: "images" },
    { kind: "tool", tool: "scroll", args: { to: "bottom" } },
    { kind: "tool", tool: "extractText", args: {}, bindResultTo: "text" },
    { kind: "tool", tool: "snapshotDOM", args: { depth: 5 }, bindResultTo: "dom" }
  ]
};
