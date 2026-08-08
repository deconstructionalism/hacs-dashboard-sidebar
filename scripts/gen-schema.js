// Generates src/lib/schema.generated.ts from the config interfaces in
// src/lib/types.ts. This is the single source of the schema *facts* used at
// runtime: which fields each block/config/footer accepts, and the allowed
// values for the enum-like unions (align, position, hour format). The validator
// and the editor import these instead of hand-maintaining their own copies.
//
//   npm run schema:gen     regenerate src/lib/schema.generated.ts
//   npm run schema:check   fail if the committed file is stale (CI)
//
// Validation *logic* and the legacy-compat keys stay hand-written in
// validate.ts; only the field/enum facts come from here.

import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const TYPES = resolve(root, 'src/lib/types.ts');
const OUT = resolve(root, 'src/lib/schema.generated.ts');

// Block interfaces, in the order the union declares them. Each maps to one
// `type` discriminator value.
const BLOCK_INTERFACES = [
  'TitleBlock',
  'ClockBlock',
  'DateBlock',
  'DividerBlock',
  'ItemBlock',
  'CategoryBlock',
  'MarkdownBlock',
  'CardBlock',
];

const program = ts.createProgram([TYPES], {
  ...ts.getDefaultCompilerOptions(),
  skipLibCheck: true,
});
const source = program.getSourceFile(TYPES);
if (!source) throw new Error(`could not load ${TYPES}`);

const interfaces = new Map();
const aliases = new Map();
source.forEachChild((node) => {
  if (ts.isInterfaceDeclaration(node)) interfaces.set(node.name.text, node);
  else if (ts.isTypeAliasDeclaration(node)) aliases.set(node.name.text, node);
});

/** The interface this one extends, if any. */
const extendsName = (node) => {
  for (const clause of node.heritageClauses || []) {
    if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
      return clause.types[0]?.expression.getText(source);
    }
  }
  return undefined;
};

/** Flattened property names of an interface, own first then inherited, unique. */
const fieldsOf = (name, seen = new Set()) => {
  const node = interfaces.get(name);
  if (!node || seen.has(name)) return [];
  seen.add(name);
  const own = node.members
    .filter((m) => ts.isPropertySignature(m) && m.name)
    .map((m) => m.name.getText(source));
  const parent = extendsName(node);
  const inherited = parent ? fieldsOf(parent, seen) : [];
  return [...new Set([...own, ...inherited])];
};

/** The string-literal `type` discriminator of a block interface. */
const discriminator = (node) => {
  for (const m of node.members) {
    if (ts.isPropertySignature(m) && m.name && m.name.getText(source) === 'type' && m.type) {
      const lit = m.type.getText(source).match(/'([^']+)'/);
      if (lit) return lit[1];
    }
  }
  return undefined;
};

/** String-literal members of a union type alias, in source order. */
const enumOf = (name) => {
  const node = aliases.get(name);
  if (!node) return [];
  const lits = [];
  const collect = (tn) => {
    if (ts.isUnionTypeNode(tn)) tn.types.forEach(collect);
    else if (ts.isLiteralTypeNode(tn) && ts.isStringLiteral(tn.literal)) lits.push(tn.literal.text);
  };
  collect(node.type);
  return lits;
};

const blockFields = {};
for (const iface of BLOCK_INTERFACES) {
  const node = interfaces.get(iface);
  if (!node) throw new Error(`missing block interface ${iface}`);
  const key = discriminator(node);
  if (!key) throw new Error(`no type discriminator on ${iface}`);
  blockFields[key] = fieldsOf(iface);
}

/** Serialize a string array as a single-line TS literal. */
const arr = (a) => `[${a.map((s) => `'${s}'`).join(', ')}]`;

const lines = [];
lines.push('// AUTO-GENERATED from src/lib/types.ts by scripts/gen-schema.js.');
lines.push('// Do not edit by hand: run `npm run schema:gen` to regenerate.');
lines.push('// The schema-check CI step fails if this file is stale.');
lines.push('');
lines.push('/** Fields accepted on the top-level `dashboard_sidebar` config. */');
lines.push(`export const TOP_FIELDS = ${arr(fieldsOf('DashboardSidebarConfig'))} as const;`);
lines.push('');
lines.push('/** Fields shared by every block and footer button. */');
lines.push(`export const COMMON_FIELDS = ${arr(fieldsOf('BlockCommon'))} as const;`);
lines.push('');
lines.push('/** Fields accepted per block type, including inherited common fields. */');
lines.push('export const BLOCK_FIELDS = {');
for (const [key, fields] of Object.entries(blockFields)) {
  lines.push(`  ${key}: ${arr(fields)},`);
}
lines.push('} as const;');
lines.push('');
lines.push('/** Fields accepted on the footer. */');
lines.push(`export const FOOTER_FIELDS = ${arr(fieldsOf('FooterConfig'))} as const;`);
lines.push('');
lines.push('/** Fields accepted on a footer button, including inherited common fields. */');
lines.push(`export const FOOTER_BUTTON_FIELDS = ${arr(fieldsOf('FooterButtonConfig'))} as const;`);
lines.push('');
lines.push('/** Allowed `align` values. */');
lines.push(`export const ALIGNS = ${arr(enumOf('Align'))} as const;`);
lines.push('');
lines.push('/** Allowed sidebar `position` values. */');
lines.push(`export const POSITIONS = ${arr(enumOf('SidebarPosition'))} as const;`);
lines.push('');
lines.push('/** Allowed clock hour-format values. */');
lines.push(`export const HOUR_FORMATS = ${arr(enumOf('ClockHourFormat'))} as const;`);
lines.push('');

const output = lines.join('\n');

const check = process.argv.includes('--check');
if (check) {
  let existing = '';
  try {
    existing = readFileSync(OUT, 'utf8');
  } catch {
    existing = '';
  }
  if (existing !== output) {
    console.error(
      'src/lib/schema.generated.ts is out of date with src/lib/types.ts.\n' +
        'Run `npm run schema:gen` and commit the result.',
    );
    process.exit(1);
  }
  console.log('src/lib/schema.generated.ts is up to date.');
} else {
  writeFileSync(OUT, output);
  console.log(`Wrote ${OUT}`);
}
