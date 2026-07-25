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

/** Throws on a structurally invalid config so the user sees a clear error. */
export function validateConfig(config: DashboardSidebarConfig): void {
  if (!config || !Array.isArray(config.items)) {
    throw new Error('dashboard_sidebar: `items` must be a list');
  }
  config.items.forEach((entry, i) => {
    if (isDivider(entry)) {
      return;
    }
    if (!entry || typeof entry.title !== 'string') {
      throw new Error(`dashboard_sidebar: item ${i} needs a title`);
    }
    if (isCategory(entry)) {
      if (!Array.isArray(entry.items) || entry.items.length === 0) {
        throw new Error(`dashboard_sidebar: category "${entry.title}" needs sub-items`);
      }
      entry.items.forEach((sub, j) => {
        if (isCategory(sub)) {
          throw new Error(
            `dashboard_sidebar: category "${entry.title}" item ${j} cannot be a category (one level only)`,
          );
        }
        if (!sub.tap_action) {
          throw new Error(
            `dashboard_sidebar: category "${entry.title}" item ${j} needs a tap_action`,
          );
        }
      });
    } else if (!entry.tap_action) {
      throw new Error(`dashboard_sidebar: item "${entry.title}" needs a tap_action`);
    }
  });
  (config.footer_buttons ?? []).forEach((btn, i) => {
    if (!btn || typeof btn.icon !== 'string') {
      throw new Error(`dashboard_sidebar: footer button ${i} needs an icon`);
    }
    if (!btn.tap_action) {
      throw new Error(`dashboard_sidebar: footer button ${i} needs a tap_action`);
    }
  });
  if (config.clock_format && !CLOCK_ALIASES.includes(config.clock_format)) {
    const bad = invalidToken(config.clock_format, TIME_TOKENS);
    if (bad) {
      throw new Error(`dashboard_sidebar: clock_format only allows time tokens, not ${bad}`);
    }
  }
  if (config.date_format && !DATE_ALIASES.includes(config.date_format)) {
    const bad = invalidToken(config.date_format, DATE_TOKENS);
    if (bad) {
      throw new Error(`dashboard_sidebar: date_format only allows date tokens, not ${bad}`);
    }
  }
}
