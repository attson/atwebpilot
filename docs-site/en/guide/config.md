# Configuration

Open extension Settings (gear icon in the header).

## LLM

| Field | Description |
|---|---|
| Provider | Anthropic / OpenAI (or OpenAI-compatible: LiteLLM / Azure / Ollama, etc.) |
| Endpoint | Leave empty for default, or set a custom base URL (e.g. `https://api.deepseek.com/v1`) |
| Model | Pick from suggestions or type your own (`claude-sonnet-4-6`, `gpt-4o-mini`, ...) |
| API Key | Check "session only" to clear on browser close; otherwise stored in `chrome.storage.local` |
| max_tokens | Per-response cap (default 4096) |
| Max rounds | Max LLM rounds per session (default 20) |
| Optimizer model | Model used by the "optimize prompt" button; empty = use chat model |
| Continuation nudges | If the model stops without calling a tool, ask once more if it's really done (default 1) |

The API Key does **not** enter IndexedDB and is **not** included in tool bundle exports.

## Appearance

- **Theme**: dark / light / follow system
- **Default view**:
  - **Compact** (recommended) — one-line progress per tool call; click a row to expand
  - **Full** — each step shows full args / output

An eye icon in the header toggles per-session without writing back to default.

## Permission mode

Toggle in the top toolbar:

- **read** — only safe tools auto-run
- **default** — safe + caution auto-run; dangerous requires approval
- **trust** — safe + caution + allowlisted dangerous auto-run
- **yolo** — everything auto-runs (careful)

## Dangerous tool allowlist

In `trust` mode you can pick which dangerous tools (like `httpRequest(withCredentials)`) skip approval.

## Coordinator (optional)

Remote WS server URL. When connected the extension accepts remote tool step dispatch. See [Coordinator](/en/advanced/coordinator).

## Next

- [First task](/en/guide/first-task)
