// Generates docs/reference.md from the JSDoc on the config interfaces in
// src/lib/types.ts. The types file is the single source of truth: every field,
// its type, whether it is optional, and its description all live there. Run
// `npm run docs:config` to regenerate, or `npm run docs:config:check` in CI to
// fail when the committed reference has drifted from the code.

import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const TYPES = resolve(root, 'src/lib/types.ts');
const CONST = resolve(root, 'src/lib/const.ts');
const OUT = resolve(root, 'docs/reference.md');

// Friendly section titles for the interfaces we know about. Anything not listed
// falls back to its raw interface name, so a new interface still gets documented
// even before it is added here.
const TITLES = {
  DashboardSidebarConfig: 'Top-level configuration',
  BlockCommon: 'Common fields (every block and footer button)',
  TitleBlock: 'Title block',
  ClockBlock: 'Clock block',
  DateBlock: 'Date block',
  DividerBlock: 'Divider block',
  ItemBlock: 'Item block',
  CategoryBlock: 'Category block',
  MarkdownBlock: 'Markdown block',
  CardBlock: 'Card block',
  FooterConfig: 'Footer',
  FooterButtonConfig: 'Footer button',
};

// Interfaces that render as their own section, in the order they appear here.
// Kept explicit so the reference reads top-down (whole sidebar, then the shared
// fields, then each block, then the footer) rather than in source order.
const SECTION_ORDER = [
  'DashboardSidebarConfig',
  'BlockCommon',
  'TitleBlock',
  'ClockBlock',
  'DateBlock',
  'DividerBlock',
  'ItemBlock',
  'CategoryBlock',
  'MarkdownBlock',
  'CardBlock',
  'FooterConfig',
  'FooterButtonConfig',
];

/** Collapse a JSDoc comment (which may span lines) to a single-line string. */
function oneLine(text) {
  return (text || '')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Escape the pipe characters that would otherwise break a markdown table. */
function cell(text) {
  return oneLine(text).replace(/\|/g, '\\|');
}

const program = ts.createProgram([TYPES, CONST], {
  ...ts.getDefaultCompilerOptions(),
  noResolve: false,
  skipLibCheck: true,
});
const checker = program.getTypeChecker();
const source = program.getSourceFile(TYPES);
if (!source) throw new Error(`could not load ${TYPES}`);

// Collect exported constants with literal values so JSDoc `{@link NAME}` tags
// (e.g. `Default {@link DEFAULT_WIDTH}.`) render the actual value, not the name.
const linkValues = new Map();
for (const file of program.getSourceFiles()) {
  if (file.isDeclarationFile || !file.fileName.includes('/src/')) continue;
  file.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const decl of node.declarationList.declarations) {
      if (!decl.initializer || !ts.isIdentifier(decl.name)) continue;
      if (ts.isNumericLiteral(decl.initializer) || ts.isStringLiteral(decl.initializer)) {
        linkValues.set(decl.name.text, decl.initializer.text);
      }
    }
  });
}

/** Replace `{@link NAME}` with the constant's value when known, else its name. */
function resolveLinks(text) {
  return (text || '').replace(/\{@link\s+([A-Za-z0-9_]+)\s*\}/g, (_, name) =>
    linkValues.has(name) ? linkValues.get(name) : name,
  );
}

const interfaces = new Map();
const aliases = [];

source.forEachChild((node) => {
  if (ts.isInterfaceDeclaration(node)) {
    interfaces.set(node.name.text, node);
  } else if (ts.isTypeAliasDeclaration(node)) {
    aliases.push(node);
  }
});

/** The `getDocumentationComment` text for a named declaration. */
function docFor(node) {
  const sym = node.name && checker.getSymbolAtLocation(node.name);
  if (!sym) return '';
  return resolveLinks(oneLine(ts.displayPartsToString(sym.getDocumentationComment(checker))));
}

/** The string-literal discriminator (the `type` field), if the interface has one. */
function discriminator(node) {
  for (const m of node.members) {
    if (ts.isPropertySignature(m) && m.name && m.name.getText(source) === 'type' && m.type) {
      const t = m.type.getText(source);
      const lit = t.match(/'([^']+)'/);
      if (lit) return lit[1];
    }
  }
  return undefined;
}

/** Which interface, if any, this interface extends. */
function extendsName(node) {
  for (const clause of node.heritageClauses || []) {
    if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
      return clause.types[0]?.expression.getText(source);
    }
  }
  return undefined;
}

function renderFieldTable(node) {
  const rows = [];
  for (const m of node.members) {
    if (!ts.isPropertySignature(m) || !m.name) continue;
    const name = m.name.getText(source);
    const type = m.type ? m.type.getText(source) : 'unknown';
    const required = m.questionToken ? 'no' : 'yes';
    const desc = docFor(m);
    rows.push(`| \`${cell(name)}\` | \`${cell(type)}\` | ${required} | ${cell(desc)} |`);
  }
  if (!rows.length) return '';
  return ['| Field | Type | Required | Description |', '| --- | --- | --- | --- |', ...rows].join(
    '\n',
  );
}

const out = [];
out.push('<!-- Auto-generated from src/lib/types.ts by scripts/gen-config-docs.js.');
out.push('     Do not edit by hand: run `npm run docs:config` to regenerate. -->');
out.push('');
out.push('# Configuration reference');
out.push('');
out.push(
  'Every option the card accepts, generated straight from the source. Each block ' +
    'in `header` or `body` is one of the block types below, chosen by its `type` field. ' +
    'A field with **yes** in the Required column must be present; everything else is optional.',
);
out.push('');

// Render the known sections in curated order, then any extra interfaces we did
// not list (so nothing silently goes undocumented).
const rendered = new Set();
const order = [...SECTION_ORDER, ...[...interfaces.keys()].filter((n) => !SECTION_ORDER.includes(n))];

for (const name of order) {
  const node = interfaces.get(name);
  if (!node || rendered.has(name)) continue;
  rendered.add(name);

  const title = TITLES[name] || name;
  const disc = discriminator(node);
  out.push(`## ${title}`);
  out.push('');
  if (disc) {
    out.push(`Set \`type: ${disc}\` to use this block.`);
    out.push('');
  }
  const intro = docFor(node);
  if (intro) {
    out.push(intro);
    out.push('');
  }
  const parent = extendsName(node);
  if (parent) {
    out.push(
      `Also accepts the [${TITLES[parent] || parent}](#${(TITLES[parent] || parent)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')}) below.`,
    );
    out.push('');
  }
  const table = renderFieldTable(node);
  if (table) {
    out.push(table);
    out.push('');
  }
}

// Which type names actually appear in a documented field. Used to keep the
// glossary to types a config author will meet, and drop internal aliases
// (Region, BlockType, ...) that no field references.
const usedTypes = new Set();
for (const node of interfaces.values()) {
  for (const m of node.members) {
    if (ts.isPropertySignature(m) && m.type) {
      for (const tok of m.type.getText(source).match(/[A-Za-z_][A-Za-z0-9_]*/g) || []) {
        usedTypes.add(tok);
      }
    }
  }
}

// Pointers for types defined outside this file (imported from Home Assistant),
// which the compiler cannot describe. Emitted only when a field uses them.
const EXTERNAL = {
  ActionConfig: {
    def: 'action config',
    desc: 'A Home Assistant action (the `tap_action` / `hold_action` / `double_tap_action` value). See [Actions](actions.md) for the shape and every action type.',
  },
  LovelaceCardConfig: {
    def: 'card config',
    desc: 'Any Home Assistant Lovelace card configuration, exactly as you would write it on a dashboard.',
  },
};

// Field-type glossary: the referenced type aliases plus the external types,
// so readers know what `MaybeTemplate`, `Align`, `ActionConfig`, etc. mean.
out.push('## Field types');
out.push('');
out.push('The types used in the tables above.');
out.push('');
for (const node of aliases) {
  const name = node.name.text;
  if (!usedTypes.has(name)) continue;
  const def = oneLine(node.type.getText(source)).replace(/^\|\s*/, '');
  const desc = docFor(node);
  out.push(`### \`${name}\``);
  out.push('');
  out.push(`\`${def}\``);
  out.push('');
  if (desc) {
    out.push(desc);
    out.push('');
  }
}
for (const [name, { def, desc }] of Object.entries(EXTERNAL)) {
  if (!usedTypes.has(name)) continue;
  out.push(`### \`${name}\``);
  out.push('');
  out.push(`\`${def}\``);
  out.push('');
  out.push(desc);
  out.push('');
}

const markdown = out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';

const check = process.argv.includes('--check');
if (check) {
  let existing = '';
  try {
    existing = readFileSync(OUT, 'utf8');
  } catch {
    existing = '';
  }
  if (existing !== markdown) {
    console.error(
      'docs/reference.md is out of date with src/lib/types.ts.\n' +
        'Run `npm run docs:config` and commit the result.',
    );
    process.exit(1);
  }
  console.log('docs/reference.md is up to date.');
} else {
  writeFileSync(OUT, markdown);
  console.log(`Wrote ${OUT}`);
}
