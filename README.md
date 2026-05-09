# Caiji2 — AI 网页采集器（Plan 2：对话采集与工具固化）

## 装载

```bash
pnpm install
pnpm build
```

1. `chrome://extensions` → 「开发者模式」 → 「加载已解压的扩展程序」选 `dist/`
2. 任意页面右上角点扩展图标 → 侧边面板打开

## 基本用法

1. 打开「设置」页：
   - Provider 选 Anthropic 或 OpenAI
   - 填入 API Key（建议先选「仅本次会话保存」）
   - 选模型（默认是 claude-sonnet-4-6 / gpt-4o-mini）
2. 切到「对话」页（默认）：
   - 在底部输入要采集什么，例如：「把主图、详情图、前 30 条评论拿出来」
   - 点「发送」
3. AI 会调用一组工具：safe 自动跑（snapshotDOM / extractText / extractImages 等）；caution / dangerous 工具弹卡片等你点「✓ 通过」/「⊘ 跳过」/「✕ 终止」
4. 完成后顶部出现「保存为工具」对话框：填名称 / URL 模式 / 描述 → 保存到工具库
5. 下次打开同模式 URL，面板顶部 banner 推荐重放，扩展图标也会有角标

## 失败修复

工具详情页跑工具失败时，点「让 AI 修复」会跳到对话页，预填错误上下文，点「发送」让 AI 改新版本。

## DEV 入口

「DEV: JSON」页保留 Plan 1 的"粘 JSON 跑工具"功能，方便调试。

## 测试

```bash
pnpm test            # 全量
pnpm test:watch
```

## Plan 2 手测脚本

需要真 API Key 的端到端验证：

1. 打开 https://mobile.pinduoduo.com/goods.html?goods_id=<任一商品>
2. 侧边面板「对话」页输入：「把主图和标题拿出来」
3. 期望：
   - AI 流式回文本，`snapshotDOM` 卡片自动通过、`querySelector*` / `extractImages` 自动通过
   - 顶部状态条显示 round 数 / token 数
   - 完成后弹「保存为工具」
4. 保存为工具后回「工具库」→ 详情页 → 「在当前 tab 运行」应能成功重放
5. 把 step 里的 selector 改坏（详情页 → 编辑工具 v1 暂未实现，可用 DEV: JSON 临时构造一个失败工具），运行失败 → 「让 AI 修复」→ 对话页预填上下文 → 发送 → AI 给新 steps → 保存为新版本
