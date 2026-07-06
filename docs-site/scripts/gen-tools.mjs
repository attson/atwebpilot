/**
 * 从 packages/shared/src/llm/builtin-tool-defs.ts 读 TOOL_DEFS，
 * 按 severity 分组生成 docs-site/tools/*.md。
 *
 * severity 分类硬编码在本文件（与 packages/extension/src/sidepanel/chat/severity.ts
 * 保持同步），避免脚本依赖 extension 内部。
 *
 * 用法：node --loader tsx docs-site/scripts/gen-tools.mjs
 * 或者：pnpm gen（package.json 里已配）
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = resolve(__dirname, '..');
const TOOL_DEFS_PATH = resolve(__dirname, '../../packages/shared/src/llm/builtin-tool-defs.ts');

const { TOOL_DEFS } = await import(TOOL_DEFS_PATH);

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// —— severity 分类（与 packages/extension/src/sidepanel/chat/severity.ts 同步） ——
const SAFE = new Set([
  'snapshotDOM', 'querySelector', 'querySelectorAll', 'extractText',
  'extractImages', 'scroll', 'waitFor', 'hover', 'focus', 'getValue',
  'extractFormState', 'detachTab', 'askUser', 'screenshot',
  'searchBookmarks', 'searchHistory', 'switchToTab', 'closeTab',
  'takeSnapshot', 'highlightElement', 'highlightText', 'getPageInfo',
]);
const CAUTION = new Set([
  'click', 'fillInput', 'setCheckbox', 'selectOption', 'listTabs',
  'openTab', 'attachTab', 'clickByUid', 'fillByUid', 'fillForm',
  'downloadImage', 'pressKey',
]);
const DANGEROUS_FIXED = new Set([
  'readStorage', 'submitForm', 'uploadFile', 'writeStorage',
]);
// httpRequest: caution / dangerous (withCredentials)
// runJS: caution / dangerous (static-scan hit)
// navigate: safe / caution (goto)

// —— 分类到页面的映射 ——
const CATEGORY_OF = new Map();
for (const t of TOOL_DEFS) {
  const name = t.name;
  if (name === 'httpRequest' || name === 'runJS') {
    CATEGORY_OF.set(name, 'danger');   // 有 dangerous 变体的归 danger 页
    continue;
  }
  if (SAFE.has(name) || name === 'navigate') {
    // askUser / screenshot / bookmarks / history / tab-management 走 meta 页
    if (['askUser', 'screenshot', 'searchBookmarks', 'searchHistory',
         'switchToTab', 'closeTab', 'detachTab', 'highlightElement',
         'highlightText'].includes(name)) {
      CATEGORY_OF.set(name, 'meta');
    } else {
      CATEGORY_OF.set(name, 'inspect');
    }
    continue;
  }
  if (CAUTION.has(name)) {
    if (['listTabs', 'openTab', 'attachTab', 'downloadImage'].includes(name)) {
      CATEGORY_OF.set(name, 'meta');
    } else {
      CATEGORY_OF.set(name, 'action');
    }
    continue;
  }
  if (DANGEROUS_FIXED.has(name)) {
    CATEGORY_OF.set(name, 'danger');
    continue;
  }
  // Fallback
  CATEGORY_OF.set(name, 'meta');
}

function severityOf(name) {
  if (SAFE.has(name) || name === 'navigate') return 'safe';
  if (CAUTION.has(name)) return 'caution';
  if (DANGEROUS_FIXED.has(name)) return 'dangerous';
  if (name === 'httpRequest') return 'caution / dangerous (withCredentials)';
  if (name === 'runJS') return 'caution / dangerous (静态扫描命中)';
  return 'dangerous';
}

function badgeFor(name) {
  const s = severityOf(name);
  if (s.startsWith('safe')) return '🟢 safe';
  if (s.startsWith('caution')) return '🟡 caution';
  if (s.startsWith('dangerous')) return '🔴 dangerous';
  return '⚪ ' + s;
}

// —— 渲染 markdown ——
function renderTool(t) {
  const props = t.input_schema?.properties ?? {};
  const required = new Set(t.input_schema?.required ?? []);
  const rows = Object.entries(props).map(([k, v]) => {
    const type = v?.type ?? (v?.enum ? 'enum' : 'any');
    const desc = escapeHtml((v?.description ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' '));
    const req = required.has(k) ? '是' : '否';
    return `| \`${k}\` | ${type} | ${desc} | ${req} |`;
  });
  const paramsTable = rows.length
    ? `\n**参数：**\n\n| 字段 | 类型 | 说明 | 必填 |\n|---|---|---|---|\n${rows.join('\n')}\n`
    : '\n（无参数）\n';

  return [
    `## \`${t.name}\`  ${badgeFor(t.name)}`,
    '',
    escapeHtml(t.description.trim()),
    paramsTable,
    '---',
    '',
  ].join('\n');
}

const HEADER = `<!-- ⚠ 自动生成 —— 修改源在 packages/shared/src/llm/builtin-tool-defs.ts；跑 \`pnpm gen\` 重生 -->\n\n`;

// —— 分组产出 ——
const groups = { inspect: [], action: [], danger: [], meta: [] };
for (const t of TOOL_DEFS) {
  const cat = CATEGORY_OF.get(t.name) ?? 'meta';
  groups[cat].push(t);
}

const TITLES = {
  inspect: '# 探查工具',
  action:  '# 操作工具',
  danger:  '# 危险工具',
  meta:    '# 元 / 视觉工具',
};
const INTROS = {
  inspect: '页面读取类：不修改页面、不发请求（除非 `snapshotDOM` 抓大树时性能）。默认 safe，全自动执行。\n',
  action:  '页面写入类：会改 DOM 或点击。默认 caution，跟随权限模式；trust 白名单里的 tool 自动过。\n',
  danger:  '提交表单、发带 cookie 请求、写 storage、执行含敏感 API 的 JS。默认 dangerous，每次弹审。\n',
  meta:    '跨 tab、书签、历史、下载、截图、视觉高亮、征询用户。用于任务编排。\n',
};

mkdirSync(resolve(DOCS_ROOT, 'tools'), { recursive: true });

for (const [key, tools] of Object.entries(groups)) {
  const body = [
    HEADER,
    TITLES[key],
    '',
    INTROS[key],
    ...tools.map(renderTool),
  ].join('\n');
  writeFileSync(resolve(DOCS_ROOT, `tools/${key}.md`), body);
  console.log(`wrote tools/${key}.md (${tools.length} tools)`);
}

// —— overview 页 ——
const totalByCat = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length]));
const total = TOOL_DEFS.length;

const overviewRows = TOOL_DEFS
  .slice()
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((t) => {
    const cat = CATEGORY_OF.get(t.name) ?? 'meta';
    const oneLine = (t.description.split('\n')[0] ?? '').slice(0, 60);
    const oneLineSafe = escapeHtml(oneLine);
    return `| \`${t.name}\` | ${badgeFor(t.name)} | ${cat} | ${oneLineSafe.replace(/\|/g, '\\|')} |`;
  })
  .join('\n');

const overview = [
  HEADER,
  '# 工具参考总览',
  '',
  `共 **${total}** 个内置工具，按类别与 severity 分组：`,
  '',
  '| 类别 | 说明 | 数量 |',
  '|---|---|---|',
  `| [探查](/tools/inspect) | 页面读取 · safe | ${totalByCat.inspect} |`,
  `| [操作](/tools/action) | 页面写入 · caution | ${totalByCat.action} |`,
  `| [危险](/tools/danger) | 提交 / 发 cookie 请求 / runJS · dangerous | ${totalByCat.danger} |`,
  `| [元 / 视觉](/tools/meta) | 跨 tab / bookmark / history / 视觉 | ${totalByCat.meta} |`,
  '',
  '## Severity 说明',
  '',
  '- 🟢 **safe**：自动执行，无需审批',
  '- 🟡 **caution**：默认自动（依权限模式）；`read` 模式下要审',
  '- 🔴 **dangerous**：默认每次要审；`trust` 模式下按白名单放行；`yolo` 模式全自动（危险）',
  '',
  '## 速查表',
  '',
  '| 工具 | Severity | 类别 | 摘要 |',
  '|---|---|---|---|',
  overviewRows,
  '',
].join('\n');

writeFileSync(resolve(DOCS_ROOT, 'tools/overview.md'), overview);
console.log(`wrote tools/overview.md (${total} tools total)`);
