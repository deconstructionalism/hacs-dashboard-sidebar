import type { ActionConfig, LovelaceCardConfig } from 'custom-card-helpers';

import { DATE_TOKENS, TIME_TOKENS, invalidToken } from './format';

const CLOCK_ALIASES = ['iso', '24h', '12h', 'locale'];
const DATE_ALIASES = ['iso', 'locale'];

/** A string that may contain a Jinja template. Resolved at runtime. */
export type MaybeTemplate = string;

export type SidebarPosition = 'left' | 'right';
export type Align = 'left' | 'center' | 'right';

/**
 * Clock format: an alias (`iso` = %H:%M:%S, `24h` = %H:%M, `12h` = %-I:%M %p,
 * `locale`) or a strftime pattern using only time tokens, e.g. `%-I:%M:%S %p`.
 */
export type TimeFormat = string;

/**
 * Date format: an alias (`iso` = %Y-%m-%d, `locale`) or a strftime pattern
 * using only date tokens, e.g. `%A, %B %-d` (names localize).
 */
export type DateFormat = string;

export interface SidebarItemConfig {
  type?: 'item';
  title: MaybeTemplate;
  icon?: MaybeTemplate;
  text_color?: MaybeTemplate;
  icon_color?: MaybeTemplate;
  /** Target for toggle / more-info actions. Not templatable. */
  entity?: string;
  tap_action: ActionConfig;
}

export interface SidebarCategoryConfig {
  type?: 'category';
  title: MaybeTemplate;
  icon?: MaybeTemplate;
  /** Whether the category starts collapsed when the sidebar is expanded. */
  start_collapsed?: boolean;
  /** Whether to draw the vertical guide line beside the items. Default true. */
  guide_line?: boolean;
  items: SidebarItemConfig[];
}

export interface SidebarDividerConfig {
  type: 'divider';
}

export type SidebarEntry = SidebarItemConfig | SidebarCategoryConfig | SidebarDividerConfig;

export interface SidebarFooterButtonConfig {
  icon: MaybeTemplate;
  icon_color?: MaybeTemplate;
  title?: MaybeTemplate;
  /** Target for toggle / more-info actions. Not templatable. */
  entity?: string;
  tap_action: ActionConfig;
}

export interface DashboardSidebarConfig {
  position?: SidebarPosition;
  width?: number;
  start_collapsed?: boolean;
  /** Hide the sidebar on narrow (mobile) viewports. */
  hide_on_mobile?: boolean;
  /** Sidebar background: any CSS color; defaults to the theme card background. */
  background?: string;
  clock?: boolean;
  clock_format?: TimeFormat;
  /** Collapsed clock style: 24h (default) or 12h with no AM/PM label. */
  collapsed_clock_format?: '12h' | '24h';
  date?: boolean;
  date_format?: DateFormat;
  title?: MaybeTemplate;
  /** Alignment of the title, clock, and date. Default center. */
  header_align?: Align;
  /** Custom content below the clock/date: a markdown string or any card. */
  content?: string | LovelaceCardConfig;
  /** Alignment of the custom content. Default left. */
  content_align?: Align;
  /** Custom content background: any CSS color. */
  content_background?: string;
  items: SidebarEntry[];
  /** Icon buttons anchored to the bottom of the sidebar. */
  footer_buttons?: SidebarFooterButtonConfig[];
  /** Whether the footer shows its top divider bar. Default true. */
  footer_divider?: boolean;
  /**
   * Passed to the card-mod integration (if installed) to style the sidebar.
   * Target the dashboard-sidebar-* classes on the rendered elements.
   */
  card_mod?: Record<string, unknown>;
}

/** A horizontal divider between entries. */
export function isDivider(entry: SidebarEntry): entry is SidebarDividerConfig {
  return entry.type === 'divider';
}

/** A category is any entry that carries a sub-item list. */
export function isCategory(entry: SidebarEntry): entry is SidebarCategoryConfig {
  if (entry.type === 'category') {
    return true;
  }
  if (entry.type === 'item' || entry.type === 'divider') {
    return false;
  }
  return Array.isArray((entry as SidebarCategoryConfig).items);
}

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
const ITEM_KEYS = new Set([
  'type',
  'title',
  'icon',
  'text_color',
  'icon_color',
  'entity',
  'tap_action',
]);
const CATEGORY_KEYS = new Set(['type', 'title', 'icon', 'start_collapsed', 'guide_line', 'items']);
const DIVIDER_KEYS = new Set(['type']);
const FOOTER_KEYS = new Set(['icon', 'icon_color', 'title', 'entity', 'tap_action']);
const ALIGNS = ['left', 'center', 'right'];

function unknownKeys(obj: object, allowed: Set<string>, ctx: string, errors: string[]): void {
  Object.keys(obj).forEach((key) => {
    if (!allowed.has(key)) {
      errors.push(`${ctx}: unknown option "${key}"`);
    }
  });
}

function checkBool(value: unknown, ctx: string, errors: string[]): void {
  if (value !== undefined && typeof value !== 'boolean') {
    errors.push(`${ctx}: must be true or false`);
  }
}

function validateItem(item: SidebarItemConfig, ctx: string, errors: string[]): void {
  unknownKeys(item, ITEM_KEYS, ctx, errors);
  if (typeof item.title !== 'string') {
    errors.push(`${ctx}: needs a title`);
  }
  if (!item.tap_action) {
    errors.push(`${ctx}: needs a tap_action`);
  }
}

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

/** Returns a list of config problems, empty when the config is valid. */
export function validateConfig(config: DashboardSidebarConfig): string[] {
  const errors: string[] = [];
  if (!config || typeof config !== 'object') {
    return ['dashboard_sidebar: config must be a mapping'];
  }
  const c = config as Record<string, unknown>;
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
