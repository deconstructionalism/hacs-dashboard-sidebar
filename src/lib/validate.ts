import type { DashboardSidebarConfig, ItemBlock, SidebarBlock } from './types';

/** Accepted alignment values. */
const ALIGNS = ['left', 'center', 'right'];

/** Recognized keys on the top-level config. */
const TOP_KEYS = new Set([
  'position',
  'width',
  'start_collapsed',
  'hide_on_mobile',
  'background',
  'header',
  'body',
  'footer',
  'card_mod',
]);

/** CSS targeting hooks accepted on every block and footer button. */
const COMMON = ['class', 'id'];

/** Recognized block types, and the keys each one accepts. */
const BLOCK_KEYS: Record<string, Set<string>> = {
  title: new Set(['type', 'text', 'align', ...COMMON]),
  clock: new Set([
    'type',
    'format',
    'show_seconds',
    'timezone',
    'hour_format',
    'collapsed_format',
    'align',
    ...COMMON,
  ]),
  date: new Set(['type', 'format', 'timezone', 'align', ...COMMON]),
  divider: new Set(['type', ...COMMON]),
  item: new Set([
    'type',
    'title',
    'icon',
    'abbr',
    'text_color',
    'icon_color',
    'entity',
    'tap_action',
    ...COMMON,
  ]),
  category: new Set([
    'type',
    'title',
    'icon',
    'abbr',
    'start_collapsed',
    'guide_line',
    'items',
    ...COMMON,
  ]),
  markdown: new Set(['type', 'content', 'align', ...COMMON]),
  card: new Set(['type', 'card', 'align', 'background', ...COMMON]),
};

/** Recognized keys on the footer. */
const FOOTER_KEYS = new Set(['divider', 'buttons', 'card', 'markdown']);

/** Recognized keys on a footer button. */
const FOOTER_BUTTON_KEYS = new Set([
  'icon',
  'icon_color',
  'title',
  'entity',
  'tap_action',
  ...COMMON,
]);

/**
 * Reports any keys on `obj` that are not in the `allowed` set, prefixing each
 * message with the config path `ctx`.
 */
function unknownKeys(obj: object, allowed: Set<string>, ctx: string, errors: string[]): void {
  Object.keys(obj).forEach((key) => {
    if (!allowed.has(key)) {
      errors.push(`${ctx}: unknown option "${key}"`);
    }
  });
}

/**
 * Records an error when a defined value is not a boolean.
 */
function checkBool(value: unknown, ctx: string, errors: string[]): void {
  if (value !== undefined && typeof value !== 'boolean') {
    errors.push(`${ctx}: must be true or false`);
  }
}

/**
 * Records an error when a defined alignment is not left, center, or right.
 */
function checkAlign(value: unknown, ctx: string, errors: string[]): void {
  if (value !== undefined && (typeof value !== 'string' || !ALIGNS.includes(value))) {
    errors.push(`${ctx}: must be left, center, or right`);
  }
}

/**
 * Records an error when a defined value is not a string.
 */
function checkString(value: unknown, ctx: string, errors: string[]): void {
  if (value !== undefined && typeof value !== 'string') {
    errors.push(`${ctx}: must be a string`);
  }
}

/**
 * Records an error when `abbr` is set alongside an icon, since the collapsed
 * glyph override only applies when there is no icon to show.
 */
function checkAbbr(abbr: unknown, icon: unknown, ctx: string, errors: string[]): void {
  checkString(abbr, `${ctx}.abbr`, errors);
  if (abbr !== undefined && icon !== undefined) {
    errors.push(`${ctx}: abbr is only allowed when icon is not set`);
  }
}

/**
 * Validates the optional card-mod targeting hooks (`class` and `id`).
 */
function checkHooks(block: unknown, ctx: string, errors: string[]): void {
  const b = block as { class?: unknown; id?: unknown };
  checkString(b.class, `${ctx}.class`, errors);
  checkString(b.id, `${ctx}.id`, errors);
}

/**
 * Validates a single item spec: known keys, a title, and a tap_action.
 */
function validateItem(item: ItemBlock, ctx: string, errors: string[]): void {
  unknownKeys(item, BLOCK_KEYS.item, ctx, errors);
  if (item.type !== undefined && item.type !== 'item') {
    errors.push(`${ctx}: expected an item`);
  }
  if (typeof item.title !== 'string') {
    errors.push(`${ctx}: needs a title`);
  }
  if (!item.tap_action) {
    errors.push(`${ctx}: needs a tap_action`);
  }
  checkAbbr(item.abbr, item.icon, ctx, errors);
  checkHooks(item, ctx, errors);
}

/**
 * Validates one header/body block, dispatching on its declared type.
 */
function validateBlock(block: SidebarBlock, ctx: string, errors: string[]): void {
  if (!block || typeof block !== 'object') {
    errors.push(`${ctx}: must be a mapping`);
    return;
  }
  const type = (block as { type?: unknown }).type;
  if (typeof type !== 'string' || !(type in BLOCK_KEYS)) {
    errors.push(`${ctx}: needs a valid type (${Object.keys(BLOCK_KEYS).join(', ')})`);
    return;
  }
  unknownKeys(block, BLOCK_KEYS[type], ctx, errors);
  if (type !== 'item') {
    checkHooks(block, ctx, errors);
  }

  switch (type) {
    case 'title':
      if (typeof (block as { text?: unknown }).text !== 'string') {
        errors.push(`${ctx}: title needs text`);
      }
      checkAlign((block as { align?: unknown }).align, `${ctx}.align`, errors);
      break;
    case 'clock': {
      const rec = block as unknown as Record<string, unknown>;
      // format accepts a 12h/24h convention or any strftime pattern; unknown
      // tokens render literally, so they are not validated for token type.
      for (const key of ['hour_format', 'collapsed_format'] as const) {
        const val = rec[key];
        if (val !== undefined && !['12h', '24h'].includes(String(val))) {
          errors.push(`${ctx}.${key}: must be "12h" or "24h"`);
        }
      }
      checkAlign(rec.align, `${ctx}.align`, errors);
      break;
    }
    case 'date': {
      const rec = block as unknown as Record<string, unknown>;
      checkAlign(rec.align, `${ctx}.align`, errors);
      break;
    }
    case 'divider':
      break;
    case 'item':
      validateItem(block as ItemBlock, ctx, errors);
      break;
    case 'category':
      if (typeof (block as { title?: unknown }).title !== 'string') {
        errors.push(`${ctx}: category needs a title`);
      }
      checkBool(
        (block as { start_collapsed?: unknown }).start_collapsed,
        `${ctx}.start_collapsed`,
        errors,
      );
      checkBool((block as { guide_line?: unknown }).guide_line, `${ctx}.guide_line`, errors);
      checkAbbr(
        (block as { abbr?: unknown }).abbr,
        (block as { icon?: unknown }).icon,
        ctx,
        errors,
      );
      {
        const items = (block as { items?: unknown }).items;
        if (!Array.isArray(items) || items.length === 0) {
          errors.push(`${ctx}: category needs a non-empty items list`);
        } else {
          items.forEach((sub, j) => {
            const subType = (sub as { type?: unknown })?.type;
            if (subType === 'category' || subType === 'divider') {
              errors.push(`${ctx}.items[${j}]: a category can only contain items`);
            } else {
              validateItem(sub as ItemBlock, `${ctx}.items[${j}]`, errors);
            }
          });
        }
      }
      break;
    case 'markdown':
      checkAlign((block as { align?: unknown }).align, `${ctx}.align`, errors);
      if (typeof (block as { content?: unknown }).content !== 'string') {
        errors.push(`${ctx}: markdown needs content`);
      }
      break;
    case 'card':
      checkAlign((block as { align?: unknown }).align, `${ctx}.align`, errors);
      if ((block as { card?: unknown }).card === undefined) {
        errors.push(`${ctx}: card needs a card config`);
      }
      break;
    default:
      break;
  }
}

/**
 * Validates a region (header or body) as a list of blocks.
 */
function validateRegion(value: unknown, ctx: string, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    errors.push(`${ctx}: must be a list`);
    return;
  }
  value.forEach((block, i) => validateBlock(block as SidebarBlock, `${ctx}[${i}]`, errors));
}

/**
 * Validates the footer: divider flag, and buttons XOR a card.
 */
function validateFooter(footer: unknown, ctx: string, errors: string[]): void {
  if (footer === undefined) {
    return;
  }
  if (!footer || typeof footer !== 'object') {
    errors.push(`${ctx}: must be a mapping`);
    return;
  }
  unknownKeys(footer, FOOTER_KEYS, ctx, errors);
  const f = footer as {
    divider?: unknown;
    buttons?: unknown;
    card?: unknown;
    markdown?: unknown;
  };
  checkBool(f.divider, `${ctx}.divider`, errors);
  const modes = [f.buttons, f.card, f.markdown].filter((v) => v !== undefined).length;
  if (modes > 1) {
    errors.push(`${ctx}: set only one of buttons, card, or markdown`);
  }
  if (f.markdown !== undefined) {
    checkString(f.markdown, `${ctx}.markdown`, errors);
  }
  if (f.buttons !== undefined) {
    if (!Array.isArray(f.buttons)) {
      errors.push(`${ctx}.buttons: must be a list`);
    } else {
      f.buttons.forEach((btn, i) => {
        const bctx = `${ctx}.buttons[${i}]`;
        if (!btn || typeof btn !== 'object') {
          errors.push(`${bctx}: must be a mapping`);
          return;
        }
        unknownKeys(btn, FOOTER_BUTTON_KEYS, bctx, errors);
        if (typeof (btn as { icon?: unknown }).icon !== 'string') {
          errors.push(`${bctx}: needs an icon`);
        }
        if (!(btn as { tap_action?: unknown }).tap_action) {
          errors.push(`${bctx}: needs a tap_action`);
        }
        checkHooks(btn, bctx, errors);
      });
    }
  }
}

/**
 * Validates a full sidebar config and returns every problem found, so the
 * element can surface them all at once. The list is empty when valid.
 */
export function validateConfig(config: DashboardSidebarConfig): string[] {
  const errors: string[] = [];
  if (!config || typeof config !== 'object') {
    return ['dashboard_sidebar: config must be a mapping'];
  }
  const c = config as unknown as Record<string, unknown>;
  unknownKeys(config, TOP_KEYS, 'dashboard_sidebar', errors);
  if (config.position !== undefined && config.position !== 'left' && config.position !== 'right') {
    errors.push('position: must be "left" or "right"');
  }
  if (config.width !== undefined && typeof config.width !== 'number') {
    errors.push('width: must be a number');
  }
  checkBool(c.start_collapsed, 'start_collapsed', errors);
  checkBool(c.hide_on_mobile, 'hide_on_mobile', errors);
  validateRegion(config.header, 'header', errors);
  validateRegion(config.body, 'body', errors);
  if (config.header === undefined && config.body === undefined) {
    errors.push('dashboard_sidebar: needs a header or body with at least one block');
  }
  validateFooter(config.footer, 'footer', errors);
  return errors;
}
