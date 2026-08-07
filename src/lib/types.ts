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

/** Clock hour convention applied to both the expanded and collapsed views. */
export type ClockHourFormat = '12h' | '24h';

/** CSS targeting hooks shared by every block and footer button. */
export interface BlockCommon {
  /**
   * Extra CSS class(es) added to the rendered root, alongside the built-in
   * dashboard-sidebar-* classes, so card-mod can target this one element.
   */
  class?: string;
  /** CSS id set on the rendered root, so card-mod can target this one element. */
  id?: string;
  /**
   * Per-element card-mod config (a `{ style, class, ... }` object), applied to
   * this element's rendered root via the card-mod integration when installed.
   */
  card_mod?: Record<string, unknown>;
}

/** A heading block showing templatable text. Hidden while collapsed. */
export interface TitleBlock extends BlockCommon {
  /** Block discriminator. */
  type: 'title';
  /** The heading text. Templatable. */
  text: MaybeTemplate;
  /** Horizontal alignment. Default center. */
  align?: Align;
  /** Optional text color, any CSS color. Templatable. */
  text_color?: MaybeTemplate;
  /** Optional action performed when tapped. Not templatable. */
  tap_action?: ActionConfig;
  /** Optional action performed when held. Not templatable. */
  hold_action?: ActionConfig;
  /** Optional action performed when double-tapped. Not templatable. */
  double_tap_action?: ActionConfig;
  /**
   * Whether to highlight this element while its navigate tap action targets the
   * current page. Default true; set false to disable the active highlight.
   */
  active_highlight?: boolean;
}

/** A digital clock block. */
export interface ClockBlock extends BlockCommon {
  /** Block discriminator. */
  type: 'clock';
  /**
   * An strftime pattern for the time. One of the presets (`%-I:%M %p`, `%H:%M`,
   * `%-I:%M:%S %p`, `%H:%M:%S`) or any custom pattern. Empty defaults to `%H:%M`.
   */
  format?: TimeFormat;
  /** IANA time zone to render in; empty uses the system zone. */
  timezone?: string;
  /** Horizontal alignment. Default center. */
  align?: Align;
  /** Optional text color, any CSS color. Templatable. */
  text_color?: MaybeTemplate;
  /** Optional action performed when tapped. Not templatable. */
  tap_action?: ActionConfig;
  /** Optional action performed when held. Not templatable. */
  hold_action?: ActionConfig;
  /** Optional action performed when double-tapped. Not templatable. */
  double_tap_action?: ActionConfig;
  /**
   * Whether to highlight this element while its navigate tap action targets the
   * current page. Default true; set false to disable the active highlight.
   */
  active_highlight?: boolean;
}

/** A date block. */
export interface DateBlock extends BlockCommon {
  /** Block discriminator. */
  type: 'date';
  /** An strftime pattern (a preset or a custom one); empty uses the locale date. */
  format?: DateFormat;
  /** IANA time zone to render in; empty uses the system zone. */
  timezone?: string;
  /** Horizontal alignment. Default center. */
  align?: Align;
  /** Optional text color, any CSS color. Templatable. */
  text_color?: MaybeTemplate;
  /** Optional action performed when tapped. Not templatable. */
  tap_action?: ActionConfig;
  /** Optional action performed when held. Not templatable. */
  hold_action?: ActionConfig;
  /** Optional action performed when double-tapped. Not templatable. */
  double_tap_action?: ActionConfig;
  /**
   * Whether to highlight this element while its navigate tap action targets the
   * current page. Default true; set false to disable the active highlight.
   */
  active_highlight?: boolean;
}

/** A horizontal rule block. */
export interface DividerBlock extends BlockCommon {
  /** Block discriminator. */
  type: 'divider';
  /** Optional line color, any CSS color. Templatable. */
  color?: MaybeTemplate;
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
  /** Optional action performed when held. Not templatable. */
  hold_action?: ActionConfig;
  /** Optional action performed when double-tapped. Not templatable. */
  double_tap_action?: ActionConfig;
  /**
   * Whether to highlight this element while its navigate tap action targets the
   * current page. Default true; set false to disable the active highlight.
   */
  active_highlight?: boolean;
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
  /** Optional heading text color, any CSS color. Templatable. */
  text_color?: MaybeTemplate;
  /** Optional heading icon color, any CSS color. Templatable. */
  icon_color?: MaybeTemplate;
  /** Whether the group starts collapsed when the sidebar is expanded. */
  start_collapsed?: boolean;
  /** Whether to draw the vertical guide line beside the items. Default true. */
  guide_line?: boolean;
  /** The rows in this group. Categories cannot nest further. */
  items: ItemBlock[];
}

/** A markdown block: Home Assistant markdown with Jinja templating. */
export interface MarkdownBlock extends BlockCommon {
  /** Block discriminator. */
  type: 'markdown';
  /** Markdown content; Jinja templates resolve at runtime. Templatable. */
  content: MaybeTemplate;
  /** Horizontal alignment. Default left. */
  align?: Align;
  /** Optional text color, any CSS color. Templatable. */
  text_color?: MaybeTemplate;
}

/** A manual card block: any Lovelace card, authored as YAML. */
export interface CardBlock extends BlockCommon {
  /** Block discriminator. */
  type: 'card';
  /** Any Lovelace card config. */
  card: LovelaceCardConfig;
  /** Horizontal alignment of the card. Default left. */
  align?: Align;
  /** Card background, any CSS `background` value. */
  background?: string;
}

/** Any block that can appear in the header or body region. */
export type SidebarBlock =
  | TitleBlock
  | ClockBlock
  | DateBlock
  | DividerBlock
  | ItemBlock
  | CategoryBlock
  | MarkdownBlock
  | CardBlock;

/** The discriminator value of every block kind. */
export type BlockType =
  'title' | 'clock' | 'date' | 'divider' | 'item' | 'category' | 'markdown' | 'card';

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
  /** Optional action performed when held. Not templatable. */
  hold_action?: ActionConfig;
  /** Optional action performed when double-tapped. Not templatable. */
  double_tap_action?: ActionConfig;
  /**
   * Whether to highlight this element while its navigate tap action targets the
   * current page. Default true; set false to disable the active highlight.
   */
  active_highlight?: boolean;
}

/**
 * The bottom bar. Exactly one of `buttons`, `card`, or `markdown`: an ordered
 * set of icon buttons (with overflow into a dots menu), a single manual card,
 * or a markdown block. A card or markdown footer shows no dots menu and is
 * hidden while collapsed.
 */
export interface FooterConfig {
  /** Whether the footer shows its top divider bar. Default true. */
  divider?: boolean;
  /** Ordered icon buttons. Mutually exclusive with `card`/`markdown`. */
  buttons?: FooterButtonConfig[];
  /** A manual Lovelace card, replacing the buttons. */
  card?: LovelaceCardConfig;
  /** Markdown content with Jinja templating, replacing the buttons. Templatable. */
  markdown?: MaybeTemplate;
  /** Optional text color for the markdown footer, any CSS color. Templatable. */
  markdown_color?: MaybeTemplate;
  /** Action fired when the markdown footer is tapped. Not templatable. */
  tap_action?: ActionConfig;
  /** Action fired when the markdown footer is held. Not templatable. */
  hold_action?: ActionConfig;
  /** Action fired when the markdown footer is double-tapped. Not templatable. */
  double_tap_action?: ActionConfig;
}

/** The full configuration read from the Lovelace `dashboard_sidebar` key. */
export interface DashboardSidebarConfig {
  /** Edge the sidebar docks to. Default left. */
  position?: SidebarPosition;
  /** Expanded width in pixels. Default {@link DEFAULT_WIDTH}. */
  width?: number;
  /** Whether the sidebar starts collapsed, before any stored preference. */
  start_collapsed?: boolean;
  /** Hide the sidebar on narrow (mobile) viewports. */
  hide_on_mobile?: boolean;
  /**
   * Sidebar background: any CSS `background` value (color, gradient, image, …),
   * applied as the `background` shorthand. Defaults to the theme card background.
   */
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

/** The two block regions, used as stable key prefixes for block state. */
export type Region = 'header' | 'body';
