import { DATE_TOKENS, TIME_TOKENS, invalidToken } from './format';
import { isCategory, isDivider } from './guards';
import type { DashboardSidebarConfig, SidebarEntry, SidebarItemConfig } from './types';

/** Clock-format aliases accepted in place of a strftime pattern. */
const CLOCK_ALIASES = ['iso', '24h', '12h', 'locale'];

/** Date-format aliases accepted in place of a strftime pattern. */
const DATE_ALIASES = ['iso', 'locale'];

/** Recognized keys on the top-level config, for unknown-key detection. */
const TOP_KEYS = new Set([
  'type',
  'position',
  'width',
  'start_collapsed',
  'hide_on_mobile',
  'background',
  'clock',
  'clock_format',
  'collapsed_clock_format',
  'date',
  'date_format',
  'title',
  'header_align',
  'content',
  'content_align',
  'content_background',
  'items',
  'footer_buttons',
  'footer_divider',
  'card_mod',
]);

/** Recognized keys on an item entry. */
const ITEM_KEYS = new Set([
  'type',
  'title',
  'icon',
  'text_color',
  'icon_color',
  'entity',
  'tap_action',
]);

/** Recognized keys on a category entry. */
const CATEGORY_KEYS = new Set(['type', 'title', 'icon', 'start_collapsed', 'guide_line', 'items']);

/** Recognized keys on a divider entry. */
const DIVIDER_KEYS = new Set(['type']);

/** Recognized keys on a footer button. */
const FOOTER_KEYS = new Set(['icon', 'icon_color', 'title', 'entity', 'tap_action']);

/** Accepted alignment values for header and content. */
const ALIGNS = ['left', 'center', 'right'];

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
 * Validates a single item entry: known keys, a title, and a tap_action.
 */
function validateItem(item: SidebarItemConfig, ctx: string, errors: string[]): void {
  unknownKeys(item, ITEM_KEYS, ctx, errors);
  if (typeof item.title !== 'string') {
    errors.push(`${ctx}: needs a title`);
  }
  if (!item.tap_action) {
    errors.push(`${ctx}: needs a tap_action`);
  }
}

/**
 * Validates one top-level entry, dispatching on whether it is a divider,
 * category, or item, and recursing into a category's items.
 */
function validateEntry(entry: SidebarEntry, ctx: string, errors: string[]): void {
  if (!entry || typeof entry !== 'object') {
    errors.push(`${ctx}: must be a mapping`);
    return;
  }
  if (isDivider(entry)) {
    unknownKeys(entry, DIVIDER_KEYS, ctx, errors);
    return;
  }
  if (isCategory(entry)) {
    unknownKeys(entry, CATEGORY_KEYS, ctx, errors);
    if (typeof entry.title !== 'string') {
      errors.push(`${ctx}: category needs a title`);
    }
    checkBool(entry.start_collapsed, `${ctx}.start_collapsed`, errors);
    checkBool(entry.guide_line, `${ctx}.guide_line`, errors);
    if (!Array.isArray(entry.items) || entry.items.length === 0) {
      errors.push(`${ctx}: category needs a non-empty items list`);
    } else {
      entry.items.forEach((sub, j) => {
        if (isCategory(sub) || isDivider(sub)) {
          errors.push(`${ctx}.items[${j}]: a category can only contain items`);
        } else {
          validateItem(sub, `${ctx}.items[${j}]`, errors);
        }
      });
    }
    return;
  }
  validateItem(entry, ctx, errors);
}

/**
 * Validates a full sidebar config and returns every problem found, so the
 * element can surface them all at once. The list is empty when the config is
 * valid.
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
  checkBool(c.clock, 'clock', errors);
  checkBool(c.date, 'date', errors);
  checkBool(c.footer_divider, 'footer_divider', errors);
  if (config.header_align && !ALIGNS.includes(config.header_align)) {
    errors.push('header_align: must be left, center, or right');
  }
  if (config.content_align && !ALIGNS.includes(config.content_align)) {
    errors.push('content_align: must be left, center, or right');
  }
  if (
    config.collapsed_clock_format &&
    config.collapsed_clock_format !== '12h' &&
    config.collapsed_clock_format !== '24h'
  ) {
    errors.push('collapsed_clock_format: must be "12h" or "24h"');
  }
  if (config.clock_format && !CLOCK_ALIASES.includes(config.clock_format)) {
    const bad = invalidToken(config.clock_format, TIME_TOKENS);
    if (bad) {
      errors.push(`clock_format: only allows time tokens, not ${bad}`);
    }
  }
  if (config.date_format && !DATE_ALIASES.includes(config.date_format)) {
    const bad = invalidToken(config.date_format, DATE_TOKENS);
    if (bad) {
      errors.push(`date_format: only allows date tokens, not ${bad}`);
    }
  }

  if (!Array.isArray(config.items)) {
    errors.push('items: must be a list');
  } else {
    config.items.forEach((entry, i) => validateEntry(entry, `items[${i}]`, errors));
  }

  if (config.footer_buttons !== undefined) {
    if (!Array.isArray(config.footer_buttons)) {
      errors.push('footer_buttons: must be a list');
    } else {
      config.footer_buttons.forEach((btn, i) => {
        const ctx = `footer_buttons[${i}]`;
        if (!btn || typeof btn !== 'object') {
          errors.push(`${ctx}: must be a mapping`);
          return;
        }
        unknownKeys(btn, FOOTER_KEYS, ctx, errors);
        if (typeof btn.icon !== 'string') {
          errors.push(`${ctx}: needs an icon`);
        }
        if (!btn.tap_action) {
          errors.push(`${ctx}: needs a tap_action`);
        }
      });
    }
  }

  return errors;
}
