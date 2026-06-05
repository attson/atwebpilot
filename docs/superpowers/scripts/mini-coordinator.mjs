// docs/superpowers/scripts/mini-coordinator.mjs
// Minimal WS coordinator for smoke-testing the extension. Run:
//   pnpm add -wD ws    (one-time)
//   node docs/superpowers/scripts/mini-coordinator.mjs

import { WebSocketServer } from "ws";

const PROTOCOL_VERSION = 1;
const PORT = 8787;

const wss = new WebSocketServer({ port: PORT, path: "/worker" });
console.log(`mini-coordinator listening on ws://127.0.0.1:${PORT}/worker`);
console.log(`token: any non-empty string. Settings page bearer protocol works as-is.`);

wss.on("connection", (socket) => {
  console.log("worker connected");

  socket.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === "HELLO") {
      console.log("HELLO from", msg.worker_id, "tabs:", msg.available_tabs?.length ?? 0);
      socket.send(JSON.stringify({
        type: "WELCOME", nonce: "wn", ts: Date.now(),
        protocol_version: PROTOCOL_VERSION,
        server_time: Date.now(), heartbeat_interval_ms: 20000
      }));
      return;
    }
    if (msg.type === "CHAT_EVENT") {
      console.log(`[${msg.session_id}] ${msg.event.type}`,
        msg.event.type === "text_delta" ? JSON.stringify(msg.event.text).slice(0, 60)
        : msg.event.type === "session_end" ? `status=${msg.event.status}` + (msg.event.reason ? ` reason=${msg.event.reason}` : "")
        : "");
      return;
    }
    if (msg.type === "SIDEPANEL_STATE_REPLY") {
      console.log("SIDEPANEL_STATE_REPLY", JSON.stringify(msg, null, 2));
      return;
    }
    if (msg.type === "PING") return;
    console.log("← from worker:", msg.type);
  });

  // 1) After connect, immediately try a START_CHAT_SESSION with mock rounds.
  setTimeout(() => {
    socket.send(JSON.stringify({
      type: "START_CHAT_SESSION", nonce: "sc", ts: Date.now(),
      protocol_version: PROTOCOL_VERSION,
      session_id: "smoke-1", user_prompt: "smoke test prompt",
      mock_llm: {
        rounds: [
          [{ type: "text_delta", text: "采集完成 5 条" }, { type: "message_end", usage: { input_tokens: 1, output_tokens: 1 } }],
          [{ type: "tool_use_start", id: "t1", name: "httpRequest" },
           { type: "tool_use_input_delta", id: "t1", partial_json: "{\"url\":\"https://example.org\"}" },
           { type: "tool_use_end", id: "t1", input: { url: "https://example.org" } },
           { type: "message_end", usage: { input_tokens: 1, output_tokens: 1 } }],
          [{ type: "text_delta", text: "确认已完成" }, { type: "message_end", usage: { input_tokens: 1, output_tokens: 1 } }]
        ]
      }
    }));
  }, 1000);

  // 2) After 3s, probe sidepanel state for any open session.
  setTimeout(() => {
    socket.send(JSON.stringify({
      type: "READ_SIDEPANEL_STATE", nonce: "pr", ts: Date.now(),
      protocol_version: PROTOCOL_VERSION,
      req_id: "probe-1", tab_id: "ACTIVE_TAB_ID_HERE_OR_LET_DEFAULT_FAIL"
    }));
  }, 3000);
});
