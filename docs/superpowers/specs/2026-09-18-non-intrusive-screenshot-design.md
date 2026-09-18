# Non-intrusive MCP screenshot design

## Problem

MCP sessions are already bound to a tab, but `switchToTab` is advertised in
the default core tool set. Agents therefore call it as setup for ordinary
page operations. The handler activates the tab and focuses its window, which
interrupts unrelated user work.

`browser_screenshot` has a second source of disruption. Its default backend is
`chrome.tabs.captureVisibleTab`, so an inactive target must be activated before
capture. Full-page capture also scrolls and stitches the live page.

## Design

### Foreground switching is explicit and discoverable

- Remove `switchToTab` from the MCP core set.
- Keep it available in full mode and through `browser_discoverTools` under a
  dedicated `tabs` group.
- Describe it as a user-visible action that must only be used when the user
  explicitly asks to show or foreground the session tab. Other session-bound
  tools do not require it.

This is an MCP surface change only. The side-panel builtin remains available.

### Prefer CDP screenshots

When the existing optional CDP recorder setting is enabled, `screenshot`
lazily attaches to the target and calls `Page.captureScreenshot`:

- viewport capture uses the CSS visual viewport as its clip;
- `fullPage` uses `Page.getLayoutMetrics` plus `captureBeyondViewport`;
- selector and page-index targets are captured by page-coordinate clip without
  scrolling or highlighting the live page;
- `format` and `scale` apply to all CDP captures.

CDP capture does not activate the tab or focus its window. It reuses the
existing optional `debugger` permission and recorder lifecycle; screenshot
does not request that permission itself.

### Compatible fallback

When CDP is disabled or cannot attach, retain the existing
`captureVisibleTab` implementation. Restore the previously active tab only if
the capture target is still active. If the user switches elsewhere during a
capture, their choice wins.

The result includes `backend: "cdp" | "visible-tab"` so callers and diagnostics
can distinguish non-intrusive capture from the compatibility path.

## Failure and safety

- CDP attach failure degrades to visible-tab capture; it is not a screenshot
  failure by itself.
- Invalid or missing selectors fail before capture instead of silently taking
  an unrelated viewport screenshot.
- Scale is clamped to `0.1..1`; zero-sized clips fail clearly.
- Existing debugger detach, DevTools contention, restricted-page, and tab
  cleanup behavior remains unchanged.

## Verification

- Unit tests prove CDP viewport, full-page, selector clip, format, and scale
  parameters.
- Background capture tests prove CDP avoids tab activation, fallback still
  works, and fallback restoration respects a concurrent user tab switch.
- MCP tests prove `switchToTab` is absent from core, discoverable under `tabs`,
  and carries the explicit foreground-only description.
- Full monorepo typecheck, test, and extension build remain green.
