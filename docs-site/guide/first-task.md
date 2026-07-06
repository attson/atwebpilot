# 走通第一条任务

## 打开维基百科

任意一条维基百科条目，比如 [Chrome extensions](https://en.wikipedia.org/wiki/Browser_extension)。

## 打开侧边面板

浏览器右上角扩展图标 → 侧边面板出现，Header 显示当前 tab URL。

## 输入指令

底部输入框：

```
用三个要点总结此页
```

按 Enter 发送。

## 观察 AI 做什么

简洁模式下你会看到工具进展一行行滚动（图为示意）：

![简洁模式下的工具进展](/mockups/compact-mode.svg)

- `✓ 抓 DOM 结构 · 2ms`
- `✓ 提取文本 · 3ms`
- 然后 AI 输出三个要点

如果切成详细模式（Header 眼睛图标），能看到每个工具的完整参数：

![详细模式下的完整卡片](/mockups/full-mode.svg)

## 危险工具会弹审批

试试：

```
在页面搜索框搜 "React"
```

AI 想 `fillInput` + `submitForm`。`submitForm` 是 dangerous，会自动弹完整卡片让你审：

![审批弹窗](/mockups/approval-flow.svg)

三选一：**通过 / 跳过 / 终止**。

## 下一步

- [工具参考](/tools/overview) — 41 个内置工具的完整参数
- [保存为工具](/advanced/save-as-tool) — 把这次会话固化，下次一键跑
