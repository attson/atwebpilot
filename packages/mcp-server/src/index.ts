import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Coordinator, DefaultClock, DefaultIdGen } from "@atwebpilot/coordinator";
import { LoopbackWSHub } from "./loopback-ws-hub";
import { createMcpServer } from "./mcp-server";
import { installWire } from "./wire";

// ⚠ stdout 是 MCP 通道，日志一律 console.error。
async function main(): Promise<void> {
  const port = Number(process.env.WEBPILOT_WS_PORT ?? 8787);
  const token = process.env.WEBPILOT_WS_TOKEN || undefined;

  const clock = new DefaultClock();
  const idGen = new DefaultIdGen();
  const hub = new LoopbackWSHub({ port, token, clock, idGen });
  await hub.ready();
  const coordinator = new Coordinator({ hub, clock, idGen });
  installWire(hub, coordinator, clock);

  const server = createMcpServer({ coordinator, hub });
  await server.connect(new StdioServerTransport());
  console.error(`[atwebpilot-mcp] ws://127.0.0.1:${port}/worker ready; stdio MCP connected`);
}

main().catch((e) => { console.error("[atwebpilot-mcp] fatal", e); process.exit(1); });
