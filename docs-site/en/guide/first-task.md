# Your first task

## Open a Wikipedia page

Any article, e.g. [Browser extension](https://en.wikipedia.org/wiki/Browser_extension).

## Open the side panel

Extension icon → side panel opens; header shows the current tab URL.

## Prompt

Type in the input:

```
Summarize this page in three bullets
```

Hit Enter.

## Watch the tool calls scroll

In compact mode you'll see rows tick through:

![Compact-mode tool progress](/mockups/compact-mode.svg)

- `✓ snapshotDOM · 2ms`
- `✓ extractText · 3ms`
- Then the three-bullet answer.

Switch to full mode (eye icon in header) to see each tool's full args:

![Full-mode expanded card](/mockups/full-mode.svg)

## Dangerous tools require approval

Try:

```
Search "React" in the search box
```

The AI wants `fillInput` + `submitForm`. `submitForm` is dangerous → the full card auto-expands for review:

![Approval flow](/mockups/approval-flow.svg)

Three options: **Approve / Skip / Abort**.

## Next

- [Tool reference](/en/tools/overview)
- [Save as tool](/en/advanced/save-as-tool)
