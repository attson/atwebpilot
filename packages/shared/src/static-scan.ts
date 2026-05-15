import type { ScanFinding, Severity } from "./types";

type Rule = {
  rule: string;
  severity: Severity;
  message: string;
  pattern: RegExp;
};

const RULES: Rule[] = [
  { rule: "uses-document-cookie", severity: "dangerous", message: "读取/写入 cookie",
    pattern: /\bdocument\s*\.\s*cookie\b/g },
  { rule: "uses-eval", severity: "dangerous", message: "eval() 执行动态代码",
    pattern: /\beval\s*\(/g },
  { rule: "uses-new-function", severity: "dangerous", message: "new Function 执行动态代码",
    pattern: /\bnew\s+Function\s*\(/g },
  { rule: "uses-chrome-api", severity: "dangerous", message: "尝试访问扩展 API",
    pattern: /\b(chrome|browser)\s*\.\s*[a-zA-Z_$]/g },
  { rule: "uses-fetch", severity: "caution", message: "发起网络请求 (fetch)",
    pattern: /\bfetch\s*\(/g },
  { rule: "uses-xhr", severity: "caution", message: "发起网络请求 (XMLHttpRequest)",
    pattern: /\bnew\s+XMLHttpRequest\b|\bXMLHttpRequest\s*\(/g },
  { rule: "uses-send-beacon", severity: "caution", message: "navigator.sendBeacon",
    pattern: /navigator\s*\.\s*sendBeacon\b/g },
  { rule: "uses-storage", severity: "caution", message: "读/写 localStorage / sessionStorage",
    pattern: /\b(local|session)Storage\b/g },
  { rule: "uses-indexed-db", severity: "caution", message: "读/写 IndexedDB",
    pattern: /\bindexedDB\b/g },
  { rule: "uses-mutation-observer", severity: "info", message: "MutationObserver",
    pattern: /\bMutationObserver\b/g }
];

export function runStaticScan(source: string): ScanFinding[] {
  const out: ScanFinding[] = [];
  for (const r of RULES) {
    const matches = collectMatches(source, r.pattern);
    if (matches.length > 0) {
      out.push({
        rule: r.rule,
        severity: r.severity,
        message: r.message,
        matches
      });
    }
  }
  return out;
}

export function highestSeverity(findings: ScanFinding[]): Severity {
  if (findings.some((f) => f.severity === "dangerous")) return "dangerous";
  if (findings.some((f) => f.severity === "caution")) return "caution";
  return "info";
}

function collectMatches(source: string, pattern: RegExp): ScanFinding["matches"] {
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  const out: ScanFinding["matches"] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const { line, col } = locate(source, m.index);
    out.push({ line, col, text: m[0] });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

function locate(source: string, offset: number): { line: number; col: number } {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset; i++) {
    if (source.charCodeAt(i) === 10) {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}
