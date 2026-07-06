---
layout: home
hero:
  name: AtWebPilot
  text: AI Web Assistant
  tagline: Read, write, and scrape from the tab you're on
  image:
    src: /mockups/sidepanel-hero.svg
    alt: AtWebPilot side panel
  actions:
    - theme: brand
      text: Download latest
      link: https://github.com/attson/atwebpilot/releases/latest
    - theme: alt
      text: View on GitHub
      link: https://github.com/attson/atwebpilot
features:
  - title: Read
    details: Summarize, translate, extract key points, answer questions about the page
  - title: Write
    details: Fill forms, check boxes, select dropdowns, click, submit, upload
  - title: Scrape
    details: Product images, detail images, comment lists → structured data
  - title: Save
    details: Freeze any successful conversation into a URL-pattern-matched replayable tool
---

## Three prompts to get started

```
Summarize this page
```

```
Check mushroom and cheese
```

```
Scrape the first 50 comments
```

## Drive it from Claude Code via MCP

    claude mcp add atwebpilot --scope user -- npx -y @attson/atwebpilot-mcp

See [MCP Bridge](/en/advanced/mcp-bridge) for details.
