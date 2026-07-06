# Installation

Three ways to use it.

## Option 1: Browser extension only

1. Grab `atwebpilot-<version>.zip` from [Releases](https://github.com/attson/atwebpilot/releases/latest) and unzip
2. Open `chrome://extensions`
3. Turn on "Developer mode" (top-right)
4. Click "Load unpacked" → select the unzipped `dist/` directory
5. Click the extension icon on any page → side panel opens

## Option 2: Add MCP so Claude Code can drive the browser

```bash
claude mcp add atwebpilot --scope user -- npx -y @attson/atwebpilot-mcp
```

Then install the extension as in Option 1. In extension Settings → Coordinator, enter `ws://127.0.0.1:8787/worker` and connect.

See [MCP Bridge](/en/advanced/mcp-bridge).

## Option 3: Build from source

```bash
git clone https://github.com/attson/atwebpilot
cd atwebpilot
pnpm install
pnpm build       # → packages/extension/dist/
```

Then back to Option 1 steps 2–5.

## Next

- [Configuration](/en/guide/config)
- [First task](/en/guide/first-task)
