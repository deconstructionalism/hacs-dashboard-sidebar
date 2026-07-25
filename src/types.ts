import type { ActionConfig, LovelaceCardConfig } from 'custom-card-helpers';

/** A string that may contain a Jinja template. Resolved at runtime. */
export type MaybeTemplate = string;

export type SidebarPosition = 'left' | 'right';
export type TimeFormat = 'iso' | 'locale';
export type DateFormat = 'iso' | 'locale';

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
  items: SidebarItemConfig[];
}

export type SidebarEntry = SidebarItemConfig | SidebarCategoryConfig;

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
  collapsed_width?: number;
  start_collapsed?: boolean;
  clock?: boolean;
  clock_format?: TimeFormat;
  date?: boolean;
  date_format?: DateFormat;
  title?: MaybeTemplate;
  /** Custom content below the clock/date: a markdown string or any card. */
  content?: string | LovelaceCardConfig;
  items: SidebarEntry[];
  /** Icon buttons anchored to the bottom of the sidebar. */
  footer_buttons?: SidebarFooterButtonConfig[];
}

/** A category is any entry that carries a sub-item list. */
export function isCategory(entry: SidebarEntry): entry is SidebarCategoryConfig {
  if (entry.type === 'category') {
    return true;
  }
  if (entry.type === 'item') {
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
}
