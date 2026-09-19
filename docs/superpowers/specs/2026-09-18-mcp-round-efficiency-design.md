# MCP Round Efficiency Design

**Status:** implemented.

## Problem

Real MCP sessions show avoidable model turns around otherwise successful tool
calls. In one responsive-page workflow the agent called `resize`, took a
`screenshot`, then used `runJS` twice to recover viewport facts the tools had
already measured internally. It also called `browser_discoverTools({})` before
deciding which extra capability it needed.

Each avoidable tool round is expensive beyond its small JSON arguments: the
default MCP surface is about 16k characters (roughly 4.5k tokens) and the
conversation plus prior tool results grows on every turn.

## Goals

- Make successful screenshot and resize calls self-verifying.
- Let an agent enable a known discovery group in one call.
- Preserve existing tool names, arguments, result fields, capability checks,
  and approval behavior.
- Improve agent guidance so it trusts verified postconditions and avoids fixed
  waits when a tool already returns the needed state.

## Design

### Screenshot metadata survives MCP conversion

`screenshot` already returns `backend`, dimensions, target information and
capture details beside its base64 payload. MCP currently emits only the image
block. It will emit the image first, followed by a compact JSON text block that
contains every top-level field except `data` and `media_type`.

This keeps image rendering compatible while exposing enough evidence to avoid
a follow-up viewport probe. The base64 payload is never duplicated into text.

### Resize verifies the actual viewport

After applying either CDP device metrics or a real window resize, `resize`
measures `window.innerWidth`, `window.innerHeight` and `devicePixelRatio`. The
main-world path polls briefly because `chrome.windows.update` may resolve before
layout catches up.

The existing `width`, `height`, `backend` and `chromeInset` fields remain. New
fields are:

```json
{
  "actualViewport": { "width": 390, "height": 844 },
  "devicePixelRatio": 1,
  "verified": true
}
```

`verified` is false rather than an exception when the browser accepts the
resize but reports a different viewport. This is useful evidence for responsive
debugging and prevents blind retries.

### Discovery enables known groups directly

`browser_discoverTools` gains `enableGroups`, whose values are the existing
discovery groups. `enable` and `enableGroups` may be supplied together; names
are deduplicated before worker-support filtering. Unknown groups are returned
as `unknownGroups` without failing valid requests.

Calling with no arguments remains a catalog operation for genuinely unknown
capabilities. Guidance changes from a mandatory catalog-then-enable sequence to
direct group activation when the group is known.

## Finding The Next Inefficiencies

A comprehensive follow-up should add opt-in MCP efficiency traces. Each trace
record should contain timestamps, tool name, redacted argument/result byte
counts, image dimensions, outcome, and a task/session correlation id. It must
not retain page text, images, credentials, or raw arguments by default.

An offline analyzer can then flag:

- repeated calls with equivalent arguments;
- `resize -> runJS(viewport)` and `screenshot -> runJS(viewport)` chains;
- fixed waits followed by a state-reading tool;
- no-argument discovery immediately followed by group activation;
- oversized text/image results and repeated full snapshots;
- error/retry loops and tools whose postconditions are routinely rechecked.

Release validation should replay a small fixed scenario suite and compare tool
rounds, result bytes, wall time, and task success at median and p95. Trace
collection is deliberately not part of this change because retention, redaction
and user opt-in need an explicit privacy decision.

## Verification

- MCP tests cover image plus metadata content blocks.
- Background tests cover verified and mismatched resize results.
- Discovery tests cover direct group activation, deduplication, unknown groups,
  worker support, and list-changed behavior.
- MCP token-budget tests, package typechecks, package tests, and extension build
  remain green.
