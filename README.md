# Caiji2 — AI 网页采集器（Plan 1：可执行骨架）

## 开发与装载

```bash
pnpm install
pnpm build           # 产出 dist/
```

1. 打开 chrome://extensions
2. 开启「开发者模式」
3. 点「加载已解压的扩展程序」选 dist/
4. 任意页面右上角点扩展图标 → 自动打开侧边面板

## 当前能力（Plan 1）

- 在「运行」页粘一个 Tool JSON → 一键在当前 tab 执行 step 列表 → 看到结果
- 成功后可保存为工具到 IndexedDB
- 「工具库」列出已保存的工具，可重放、删除
- 「设置」页可导出整个工具库为 JSON、从 JSON 导入

下一步（Plan 2）：接入 LLM，实现"自然语言 → AI 自动 tool-use → 人工逐步审阅"的对话式采集。

## 工具 JSON 示例

```json
{
  "name": "PDD 详情页采集器",
  "urlPatterns": ["https://*.yangkeduo.com/**"],
  "description": "抓主图与标题",
  "steps": [
    {
      "kind": "tool",
      "tool": "extractText",
      "args": { "selector": "h1", "single": true },
      "bindResultTo": "title"
    },
    {
      "kind": "tool",
      "tool": "extractImages",
      "args": { "root": ".product-gallery" }
    }
  ],
  "outputSchema": {}
}
```

## 测试

```bash
pnpm test            # 一次跑完
pnpm test:watch      # 监听
```
