import {
  ALIGNS,
  BLOCK_FIELDS,
  FOOTER_BUTTON_FIELDS,
  FOOTER_FIELDS,
  TOP_FIELDS,
} from './schema.generated';
import type { DashboardSidebarConfig, ItemBlock, SidebarBlock } from './types';

/** Accepted alignment values, as a set for lookups. */
const ALIGN_SET = new Set<string>(ALIGNS);

/** Recognized keys on the top-level config. */
const TOP_KEYS = new Set<string>(TOP_FIELDS);

/**
 * Legacy clock keys still accepted so old configs do not error. They are not
 * part of the current schema: the clock renderer and the editor fold them into
 * the `format` pattern (see the migration in dashboard-sidebar.ts).
 */
const LEGACY_CLOCK_KEYS = ['hour_format', 'collapsed_format'];

/**
 * Recognized block types, and the keys each one accepts. Field sets come from
 * the generated schema; the clock also tolerates its legacy keys.
 */
const BLOCK_KEYS: Record<string, Set<string>> = Object.fromEntries(
  Object.entries(BLOCK_FIELDS).map(([type, fields]) => [
    type,
    new Set<string>(type === 'clock' ? [...fields, ...LEGACY_CLOCK_KEYS] : fields),
  ]),
);

/** Recognized keys on the footer. */
const FOOTER_KEYS = new Set<string>(FOOTER_FIELDS);

/** Recognized keys on a footer button. */
const FOOTER_BUTTON_KEYS = new Set<string>(FOOTER_BUTTON_FIELDS);

/**
 * Reports any keys on `obj` that are not in the `allowed` set, prefixing each
 * message with the config path `ctx`.
 */
const unknownKeys = (obj: object, allowed: Set<string>, ctx: string, errors: string[]): void => {
  Object.keys(obj).forEach((key) => {
    if (!allowed.has(key)) {
      errors.push(`${ctx}: unknown option "${key}"`);
    }
  });
};

/**
 * Records an error when a defined value is not a boolean.
 */
const checkBool = (value: unknown, ctx: string, errors: string[]): void => {
  if (value !== undefined && typeof value !== 'boolean') {
    errors.push(`${ctx}: must be true or false`);
  }
};

/**
 * Records an error when a defined alignment is not left, center, or right.
 */
const checkAlign = (value: unknown, ctx: string, errors: string[]): void => {
  if (value !== undefined && (typeof value !== 'string' || !ALIGN_SET.has(value))) {
    errors.push(`${ctx}: must be left, center, or right`);
  }
};

/**
 * Records an error when a defined value is not a string.
 */
const checkString = (value: unknown, ctx: string, errors: string[]): void => {
  if (value !== undefined && typeof value !== 'string') {
    errors.push(`${ctx}: must be a string`);
  }
};

/**
 * Records an error when `abbr` is set alongside an icon, since the collapsed
 * glyph override only applies when there is no icon to show.
 */
const checkAbbr = (abbr: unknown, icon: unknown, ctx: string, errors: string[]): void => {
  checkString(abbr, `${ctx}.abbr`, errors);
  if (abbr !== undefined && icon !== undefined) {
    errors.push(`${ctx}: abbr is only allowed when icon is not set`);
  }
};

/**
 * Records an error when a defined value is not a plain mapping.
 */
const checkMapping = (value: unknown, ctx: string, errors: string[]): void => {
  if (
    value !== undefined &&
    (typeof value !== 'object' || value === null || Array.isArray(value))
  ) {
    errors.push(`${ctx}: must be a mapping`);
  }
};

/**
 * Validates the optional card-mod hooks (`class`, `id`, and `card_mod`).
 */
const checkHooks = (block: unknown, ctx: string, errors: string[]): void => {
  const b = block as { class?: unknown; id?: unknown; card_mod?: unknown };
  checkString(b.class, `${ctx}.class`, errors);
  checkString(b.id, `${ctx}.id`, errors);
  checkMapping(b.card_mod, `${ctx}.card_mod`, errors);
};

/**
 * Validates a single item spec: known keys, a title, and a tap_action.
 */
const validateItem = (item: ItemBlock, ctx: string, errors: string[]): void => {
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
  checkBool(
    (item as { active_highlight?: unknown }).active_highlight,
    `${ctx}.active_highlight`,
    errors,
  );
};

/**
 * Validates one header/body block, dispatching on its declared type.
 */
const validateBlock = (block: SidebarBlock, ctx: string, errors: string[]): void => {
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
    checkBool(
      (block as { active_highlight?: unknown }).active_highlight,
      `${ctx}.active_highlight`,
      errors,
    );
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
};

/**
 * Validates a region (header or body) as a list of blocks.
 */
const validateRegion = (value: unknown, ctx: string, errors: string[]): void => {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    errors.push(`${ctx}: must be a list`);
    return;
  }
  value.forEach((block, i) => validateBlock(block as SidebarBlock, `${ctx}[${i}]`, errors));
};

/**
 * Validates the footer: divider flag, and buttons XOR a card.
 */
const validateFooter = (footer: unknown, ctx: string, errors: string[]): void => {
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
      f.buttons.forEach((btn, i) => validateFooterButton(btn, `${ctx}.buttons[${i}]`, errors));
    }
  }
};

/**
 * Validates a single footer button: known keys, an icon, and a tap_action.
 */
const validateFooterButton = (btn: unknown, ctx: string, errors: string[]): void => {
  if (!btn || typeof btn !== 'object') {
    errors.push(`${ctx}: must be a mapping`);
    return;
  }
  unknownKeys(btn, FOOTER_BUTTON_KEYS, ctx, errors);
  if (typeof (btn as { icon?: unknown }).icon !== 'string') {
    errors.push(`${ctx}: needs an icon`);
  }
  if (!(btn as { tap_action?: unknown }).tap_action) {
    errors.push(`${ctx}: needs a tap_action`);
  }
  checkHooks(btn, ctx, errors);
  checkBool(
    (btn as { active_highlight?: unknown }).active_highlight,
    `${ctx}.active_highlight`,
    errors,
  );
};

/**
 * Validates a full sidebar config and returns every problem found, so the
 * element can surface them all at once. The list is empty when valid.
 */
export const validateConfig = (config: DashboardSidebarConfig): string[] => {
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
  checkMapping(c.card_mod, 'card_mod', errors);
  validateRegion(config.header, 'header', errors);
  validateRegion(config.body, 'body', errors);
  if (config.header === undefined && config.body === undefined) {
    errors.push('dashboard_sidebar: needs a header or body with at least one block');
  }
  validateFooter(config.footer, 'footer', errors);
  return errors;
};

/**
 * Strips the leading context path (e.g. `element` / `element.align`) from each
 * message, for surfacing single-element errors without the placeholder prefix.
 */
const stripCtx = (errors: string[]): string[] => {
  return errors.map((e) => e.replace(/^element[.:]?\s*/, ''));
};

/**
 * Validates one header/body block against its type's schema, returning the
 * problems found. Used to check a YAML-edited element live.
 */
export const validateBlockConfig = (block: unknown): string[] => {
  const errors: string[] = [];
  validateBlock(block as SidebarBlock, 'element', errors);
  return stripCtx(errors);
};

/**
 * Validates one category child item against the item schema.
 */
export const validateItemConfig = (item: unknown): string[] => {
  const errors: string[] = [];
  const type = (item as { type?: unknown })?.type;
  if (type === 'category' || type === 'divider') {
    errors.push('a category can only contain items');
  } else {
    validateItem(item as ItemBlock, 'element', errors);
  }
  return stripCtx(errors);
};

/**
 * Validates one footer button against the footer-button schema.
 */
export const validateFooterButtonConfig = (btn: unknown): string[] => {
  const errors: string[] = [];
  validateFooterButton(btn, 'element', errors);
  return stripCtx(errors);
};
