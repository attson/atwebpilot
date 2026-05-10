# WebPilot — AI 网页助手

一个浏览器侧边面板里的 AI 助手，能在你正在浏览的网页上：

- **读**：总结、翻译、抽取重点、回答关于本页内容的问题
- **写**：填表、勾选、选下拉、点击按钮、提交表单、上传文件
- **采**：抓主图、详情图、评论列表等结构化数据

任意一段对话产出（无论是读、写还是采）都可以一键固化为 URL 模式匹配的可重放工具，下次打开同类页面时面板顶部 banner 推荐重放。

## 装载

```bash
pnpm install
pnpm build
```

1. `chrome://extensions` → 「开发者模式」 → 「加载已解压的扩展程序」选 `dist/`
2. 任意页面右上角点扩展图标 → 侧边面板打开

## 基本用法

1. 打开「设置」页：
   - Provider 选 Anthropic 或 OpenAI（或填自定义 endpoint 接 LiteLLM / Azure / Ollama）
   - 填入 API Key（建议先选「仅本次会话保存」）
   - 选模型；可在输入框直接填任意 model 名
   - 设置「自动通过策略」：safe 永远 auto、caution 看 toggle、dangerous 按工具白名单
2. 切到「对话」页（默认）：
   - 在底部输入要做什么，例如：
     - 「总结这篇文章三个要点」
     - 「填写注册表单：用户名 alice、邮箱 a@b.com、勾选同意条款」
     - 「把主图、详情图、前 50 条评论拿出来」
   - Ctrl/⌘ + Enter 发送
3. AI 调用工具时：
   - safe（snapshotDOM / extractText / hover / getValue 等）自动跑
   - caution（fillInput / click / setCheckbox 等）默认跟随 toggle
   - dangerous（submitForm / uploadFile / readStorage / 带 cookie 的 httpRequest / 命中扫描的 runJS）默认人工审阅，可在白名单里放行
4. 完成后顶部出现「保存为工具」按钮（点击才弹），保存到工具库
5. 下次打开同模式 URL，面板顶部 banner 推荐重放

## 失败修复

工具详情页跑工具失败时，点「让 AI 修复」会跳到对话页，预填错误上下文，点「发送」让 AI 改新版本。

## DEV 入口

「DEV: JSON」页保留粘 Tool JSON 直接跑的功能，方便调试。

## 测试

```bash
pnpm test            # 全量
pnpm test:watch
```

## 手测脚本

需要真 API Key 的端到端验证：

### 阅读类：总结
1. 打开任意维基百科条目
2. 「对话」输入「用三个要点总结此页」
3. 期望：AI 用 snapshotDOM + extractText（safe，全自动）→ 给出 3 条总结

### 操作类：填表
1. 打开 https://httpbin.org/forms/post（或任意 GitHub Issue 评论框）
2. 输入「填写：客户名 张三，电话 13800000000，比萨配料勾选 mushroom 和 cheese，配送时间 18:00」
3. 期望：AI 用 fillInput / setCheckbox（caution，需勾 toggle 才自动）；submitForm 会要审阅
4. 不点提交退出，验证表单字段确实被填好了

### 采集类
1. 打开 https://mobile.pinduoduo.com/goods.html?goods_id=<任一商品>
2. 输入「把主图和标题拿出来」
3. 期望：AI 用 snapshotDOM + querySelector* + extractImages 完成
4. 完成后保存为工具，重新访问验证 banner 推荐 + 一键重放
