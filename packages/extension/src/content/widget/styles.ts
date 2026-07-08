import cssText from "./index.css?inline";

let cachedSheet: CSSStyleSheet | null = null;

function makeSheet(): CSSStyleSheet {
  if (cachedSheet) return cachedSheet;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(cssText);
  cachedSheet = sheet;
  return sheet;
}

/** Attach the shared Tailwind stylesheet to a shadow root. Safe to call multiple times. */
export function attachStyles(shadow: ShadowRoot): void {
  const sheet = makeSheet();
  if (!shadow.adoptedStyleSheets.includes(sheet)) {
    shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet];
  }
}
