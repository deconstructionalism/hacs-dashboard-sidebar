import type { ActionConfig, LovelaceCardConfig } from 'custom-card-helpers';

/**
 * A string that may contain a Jinja template. When it does it is resolved at
 * runtime against Home Assistant; otherwise the literal string is used.
 */
export type MaybeTemplate = string;

/** Which edge of the dashboard view the sidebar docks to. */
export type SidebarPosition = 'left' | 'right';

/** Horizontal alignment applied to header or content blocks. */
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

/** Collapsed-clock rendering: 24-hour, or 12-hour with no AM/PM suffix. */
export type CollapsedClockFormat = '12h' | '24h';

/** A single tappable row in the sidebar menu. */
export interface SidebarItemConfig {
  /** Entry discriminator; optional because a bare item is the default kind. */
  type?: 'item';
  /** Text label shown for the row. Templatable. */
  title: MaybeTemplate;
  /** Optional mdi icon shown before the label. Templatable. */
  icon?: MaybeTemplate;
  /** Optional label color, any CSS color. Templatable. */
  text_color?: MaybeTemplate;
  /** Optional icon color, any CSS color. Templatable. */
  icon_color?: MaybeTemplate;
  /** Target entity for toggle / more-info actions. Not templatable. */
  entity?: string;
  /** Action performed when the row is tapped. Not templatable. */
  tap_action: ActionConfig;
}

/** A collapsible group of items, nested one level below the top menu. */
export interface SidebarCategoryConfig {
  /** Entry discriminator; optional when the entry carries an `items` list. */
  type?: 'category';
  /** Group heading text. Templatable. */
  title: MaybeTemplate;
  /** Optional mdi icon shown before the heading. Templatable. */
  icon?: MaybeTemplate;
  /** Whether the group starts collapsed when the sidebar is expanded. */
  start_collapsed?: boolean;
  /** Whether to draw the vertical guide line beside the items. Default true. */
  guide_line?: boolean;
  /** The rows contained in this group. Categories cannot nest further. */
  items: SidebarItemConfig[];
}

/** A horizontal rule drawn between entries. */
export interface SidebarDividerConfig {
  /** Entry discriminator identifying this entry as a divider. */
  type: 'divider';
}

/** Any single entry that can appear in the top-level menu list. */
export type SidebarEntry = SidebarItemConfig | SidebarCategoryConfig | SidebarDividerConfig;

/** An icon button anchored to the bottom of the sidebar. */
export interface SidebarFooterButtonConfig {
  /** mdi icon shown in the button. Templatable. */
  icon: MaybeTemplate;
  /** Optional icon color, any CSS color. Templatable. */
  icon_color?: MaybeTemplate;
  /** Optional tooltip / accessible label. Templatable. */
  title?: MaybeTemplate;
  /** Target entity for toggle / more-info actions. Not templatable. */
  entity?: string;
  /** Action performed when the button is tapped. Not templatable. */
  tap_action: ActionConfig;
}

/** The full configuration object read from the Lovelace `dashboard_sidebar` key. */
export interface DashboardSidebarConfig {
  /** Edge the sidebar docks to. Default left. */
  position?: SidebarPosition;
  /** Expanded width in pixels. Default {@link DEFAULT_WIDTH}. */
  width?: number;
  /** Whether the sidebar starts collapsed, before any stored user preference. */
  start_collapsed?: boolean;
  /** Hide the sidebar on narrow (mobile) viewports. */
  hide_on_mobile?: boolean;
  /** Sidebar background: any CSS color. Defaults to the theme card background. */
  background?: string;
  /** Whether to show the digital clock in the header. */
  clock?: boolean;
  /** Clock format for the expanded header. See {@link TimeFormat}. */
  clock_format?: TimeFormat;
  /** Clock style used while collapsed. Default 24h. */
  collapsed_clock_format?: CollapsedClockFormat;
  /** Whether to show the date in the header. */
  date?: boolean;
  /** Date format for the expanded header. See {@link DateFormat}. */
  date_format?: DateFormat;
  /** Header title text. Templatable. */
  title?: MaybeTemplate;
  /** Alignment of the title, clock, and date. Default center. */
  header_align?: Align;
  /** Custom content below the clock/date: a markdown string or any card. */
  content?: string | LovelaceCardConfig;
  /** Alignment of the custom content. Default left. */
  content_align?: Align;
  /** Custom content background: any CSS color. */
  content_background?: string;
  /** The ordered menu entries: items, categories, and dividers. */
  items: SidebarEntry[];
  /** Icon buttons anchored to the bottom of the sidebar. */
  footer_buttons?: SidebarFooterButtonConfig[];
  /** Whether the footer shows its top divider bar. Default true. */
  footer_divider?: boolean;
  /**
   * Passed to the card-mod integration (when installed) to style the sidebar.
   * Target the dashboard-sidebar-* classes on the rendered elements.
   */
  card_mod?: Record<string, unknown>;
}
