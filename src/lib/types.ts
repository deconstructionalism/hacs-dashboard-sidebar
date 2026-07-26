import type { ActionConfig, LovelaceCardConfig } from 'custom-card-helpers';

/**
 * A string that may contain a Jinja template. When it does it is resolved at
 * runtime against Home Assistant; otherwise the literal string is used.
 */
export type MaybeTemplate = string;

/** Which edge of the dashboard view the sidebar docks to. */
export type SidebarPosition = 'left' | 'right';

/** Horizontal alignment applied to a text or card block. */
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

/** CSS targeting hooks shared by every block and footer button. */
export interface BlockCommon {
  /**
   * Extra CSS class(es) added to the rendered root, alongside the built-in
   * dashboard-sidebar-* classes, so card-mod can target this one element.
   */
  class?: string;
  /** CSS id set on the rendered root, so card-mod can target this one element. */
  id?: string;
}

/** A heading block showing templatable text. Hidden while collapsed. */
export interface TitleBlock extends BlockCommon {
  /** Block discriminator. */
  type: 'title';
  /** The heading text. Templatable. */
  text: MaybeTemplate;
  /** Horizontal alignment. Default center. */
  align?: Align;
}

/** A digital clock block. */
export interface ClockBlock extends BlockCommon {
  /** Block discriminator. */
  type: 'clock';
  /** Expanded clock format. See {@link TimeFormat}. */
  format?: TimeFormat;
  /** Clock style used while collapsed. Default 24h. */
  collapsed_format?: CollapsedClockFormat;
  /** Horizontal alignment. Default center. */
  align?: Align;
}

/** A date block. */
export interface DateBlock extends BlockCommon {
  /** Block discriminator. */
  type: 'date';
  /** Expanded date format. See {@link DateFormat}. */
  format?: DateFormat;
  /** Horizontal alignment. Default center. */
  align?: Align;
}

/** A horizontal rule block. */
export interface DividerBlock extends BlockCommon {
  /** Block discriminator. */
  type: 'divider';
}

/** A single tappable row. Standalone in a region, or nested in a category. */
export interface ItemBlock extends BlockCommon {
  /** Block discriminator. Optional inside a category's item list. */
  type?: 'item';
  /** Row label. Templatable. */
  title: MaybeTemplate;
  /** Optional mdi icon shown before the label. Templatable. */
  icon?: MaybeTemplate;
  /**
   * Collapsed glyph override, used only when no icon is set. Defaults to the
   * initials of the title; set it to disambiguate colliding initials.
   */
  abbr?: string;
  /** Optional label color, any CSS color. Templatable. */
  text_color?: MaybeTemplate;
  /** Optional icon color, any CSS color. Templatable. */
  icon_color?: MaybeTemplate;
  /** Target entity for toggle / more-info actions. Not templatable. */
  entity?: string;
  /** Action performed when the row is tapped. Not templatable. */
  tap_action: ActionConfig;
}

/** A collapsible group of items, nested one level deep. */
export interface CategoryBlock extends BlockCommon {
  /** Block discriminator. */
  type: 'category';
  /** Group heading text. Templatable. */
  title: MaybeTemplate;
  /** Optional mdi icon shown before the heading. Templatable. */
  icon?: MaybeTemplate;
  /**
   * Collapsed glyph override, used only when no icon is set. Defaults to the
   * initials of the title; set it to disambiguate colliding initials.
   */
  abbr?: string;
  /** Whether the group starts collapsed when the sidebar is expanded. */
  start_collapsed?: boolean;
  /** Whether to draw the vertical guide line beside the items. Default true. */
  guide_line?: boolean;
  /** The rows in this group. Categories cannot nest further. */
  items: ItemBlock[];
}

/** A manual component: a markdown string or any Lovelace card. */
export interface CardBlock extends BlockCommon {
  /** Block discriminator. */
  type: 'card';
  /** A markdown string, or any Lovelace card config. */
  card: string | LovelaceCardConfig;
  /** Horizontal alignment of the card. Default left. */
  align?: Align;
  /** Card background, any CSS color. */
  background?: string;
}

/** Any block that can appear in the header or body region. */
export type SidebarBlock =
  TitleBlock | ClockBlock | DateBlock | DividerBlock | ItemBlock | CategoryBlock | CardBlock;

/** The discriminator value of every block kind. */
export type BlockType = 'title' | 'clock' | 'date' | 'divider' | 'item' | 'category' | 'card';

/** An icon button in the footer's button bar. */
export interface FooterButtonConfig extends BlockCommon {
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

/**
 * The bottom bar. Either an ordered set of icon buttons (with overflow into a
 * dots menu) or a single custom card. The two are mutually exclusive; a card
 * footer shows no dots menu and is hidden while collapsed.
 */
export interface FooterConfig {
  /** Whether the footer shows its top divider bar. Default true. */
  divider?: boolean;
  /** Ordered icon buttons. Mutually exclusive with `card`. */
  buttons?: FooterButtonConfig[];
  /** A markdown string or any card, replacing the buttons. */
  card?: string | LovelaceCardConfig;
}

/** The configuration for a single sidebar (one side of the dashboard). */
export interface SidebarConfig {
  /** Expanded width in pixels. Default {@link DEFAULT_WIDTH}. */
  width?: number;
  /** Whether the sidebar starts collapsed, before any stored preference. */
  start_collapsed?: boolean;
  /** Hide the sidebar on narrow (mobile) viewports. */
  hide_on_mobile?: boolean;
  /** Sidebar background: any CSS color. Defaults to the theme card background. */
  background?: string;
  /** Blocks pinned to the top, above the scrolling body. */
  header?: SidebarBlock[];
  /** Blocks in the scrolling region below the header. */
  body?: SidebarBlock[];
  /** The bottom bar configuration. */
  footer?: FooterConfig;
  /**
   * Passed to the card-mod integration (when installed) to style the sidebar.
   * Target the dashboard-sidebar-* classes on the rendered elements.
   */
  card_mod?: Record<string, unknown>;
}

/**
 * The full configuration read from the Lovelace `dashboard_sidebar` key: an
 * optional left and/or right sidebar. Keyed by side, so a dashboard can have at
 * most one of each.
 */
export interface DashboardSidebarConfig {
  /** The left sidebar, if present. */
  left?: SidebarConfig;
  /** The right sidebar, if present. */
  right?: SidebarConfig;
}

/** The two block regions, used as stable key prefixes for block state. */
export type Region = 'header' | 'body';
