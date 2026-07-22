import type { ReactNode } from "react";

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: Array<{ text: string; checked?: boolean }> }
  | { kind: "code"; text: string }
  | { kind: "table"; rows: string[][] };

export function MarkdownText({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="space-y-1.5 break-words">
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
}

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let code: string[] | null = null;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      if (code) {
        blocks.push({ kind: "code", text: code.join("\n") });
        code = null;
      } else {
        flushParagraph();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2].trim()
      });
      continue;
    }

    if (isTableStart(lines, i)) {
      flushParagraph();
      const rows: string[][] = [splitTableRow(line)];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      i--;
      blocks.push({ kind: "table", rows });
      continue;
    }

    const list = collectList(lines, i);
    if (list) {
      flushParagraph();
      blocks.push(list.block);
      i = list.nextIndex - 1;
      continue;
    }

    paragraph.push(line);
  }
  if (code) blocks.push({ kind: "code", text: code.join("\n") });
  flushParagraph();
  return blocks;
}

function collectList(lines: string[], start: number): { block: Block; nextIndex: number } | null {
  const first = parseListLine(lines[start]);
  if (!first) return null;
  const items = [first.item];
  let i = start + 1;
  while (i < lines.length) {
    const next = parseListLine(lines[i]);
    if (!next || next.ordered !== first.ordered) break;
    items.push(next.item);
    i++;
  }
  return { block: { kind: "list", ordered: first.ordered, items }, nextIndex: i };
}

function parseListLine(
  line: string
): { ordered: boolean; item: { text: string; checked?: boolean } } | null {
  const unordered = line.match(/^\s*[-*]\s+(?:\[([ xX])\]\s+)?(.+)$/);
  if (unordered) {
    return {
      ordered: false,
      item: {
        text: unordered[2],
        ...(unordered[1] ? { checked: unordered[1].toLowerCase() === "x" } : {})
      }
    };
  }
  const ordered = line.match(/^\s*\d+[.]\s+(.+)$/);
  if (!ordered) return null;
  return { ordered: true, item: { text: ordered[1] } };
}

function isTableStart(lines: string[], i: number): boolean {
  return (
    /^\s*\|.*\|\s*$/.test(lines[i] ?? "") &&
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1] ?? "")
  );
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderBlock(block: Block, key: number): ReactNode {
  if (block.kind === "heading") {
    const className = "font-semibold text-zinc-100";
    if (block.level === 1) return <h1 key={key} className={`${className} text-sm`}>{inline(block.text)}</h1>;
    if (block.level === 2) return <h2 key={key} className={`${className} text-[13px]`}>{inline(block.text)}</h2>;
    return <h3 key={key} className={className}>{inline(block.text)}</h3>;
  }
  if (block.kind === "paragraph") {
    return (
      <p key={key} className="whitespace-pre-wrap leading-relaxed">
        {inline(block.text)}
      </p>
    );
  }
  if (block.kind === "code") {
    return (
      <pre key={key} className="overflow-auto rounded bg-zinc-950 p-2 text-[11px] text-zinc-200">
        <code>{block.text}</code>
      </pre>
    );
  }
  if (block.kind === "table") {
    return (
      <div key={key} className="overflow-auto rounded border border-zinc-700">
        <table className="min-w-full text-left text-[11px]">
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r} className={r === 0 ? "bg-zinc-800 text-zinc-200" : "border-t border-zinc-800"}>
                {row.map((cell, c) =>
                  r === 0 ? (
                    <th key={c} className="px-2 py-1 font-medium">{inline(cell)}</th>
                  ) : (
                    <td key={c} className="px-2 py-1 text-zinc-300">{inline(cell)}</td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const Tag = block.ordered ? "ol" : "ul";
  if (block.ordered) {
    return (
      <Tag key={key} className="list-decimal pl-5 space-y-1">
        {block.items.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {inline(item.text)}
          </li>
        ))}
      </Tag>
    );
  }
  return (
    <Tag key={key} className="pl-1 space-y-1">
      {block.items.map((item, i) => (
        <li key={i} className="flex gap-1.5 leading-relaxed">
          {item.checked == null ? (
            <span className="text-zinc-500">-</span>
          ) : (
            <input type="checkbox" checked={item.checked} disabled className="mt-0.5 shrink-0" />
          )}
          <span>{inline(item.text)}</span>
        </li>
      ))}
    </Tag>
  );
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("`")) {
      out.push(
        <code key={out.length} className="rounded bg-zinc-950 px-1 py-0.5 font-mono text-[11px] text-zinc-100">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      out.push(<strong key={out.length}>{token.slice(2, -2)}</strong>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
