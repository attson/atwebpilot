---
layout: home
hero:
  name: AtWebPilot
  text: AI 网页助手
  tagline: 在当前 tab 上读、写、采
  image:
    src: /mockups/sidepanel-hero.svg
    alt: AtWebPilot 侧边面板
  actions:
    - theme: brand
      text: 下载最新版本
      link: https://github.com/attson/atwebpilot/releases/latest
    - theme: alt
      text: 在 GitHub 上查看
      link: https://github.com/attson/atwebpilot
features:
  - title: 读
    details: 总结、翻译、抽重点、回答本页问题
  - title: 写
    details: 填表、勾选、下拉、点击、提交、上传
  - title: 采
    details: 主图 / 详情图 / 评论列表 → 结构化数据
  - title: 固化
    details: 任意成功对话一键存成 URL 模式匹配的可重放工具
---

## 三条上手 prompt

```
总结此页
```

```
把 mushroom 和 cheese 勾上
```

```
采集前 50 条评论
```

## 也能被 Claude Code 通过 MCP 驱动

    claude mcp add atwebpilot --scope user -- npx -y @attson/atwebpilot-mcp

配合浏览器扩展和本地 Coordinator，Claude Code 可以在真实网页上读写采。见 [MCP Bridge](/advanced/mcp-bridge)。
