// AUTO-GENERATED from src/lib/types.ts by scripts/gen-schema.js.
// Do not edit by hand: run `npm run schema:gen` to regenerate.
// The schema-check CI step fails if this file is stale.

/** Fields accepted on the top-level `dashboard_sidebar` config. */
export const TOP_FIELDS = ['position', 'width', 'start_collapsed', 'hide_on_mobile', 'background', 'header', 'body', 'footer', 'card_mod'] as const;

/** Fields shared by every block and footer button. */
export const COMMON_FIELDS = ['class', 'id', 'card_mod'] as const;

/** Fields accepted per block type, including inherited common fields. */
export const BLOCK_FIELDS = {
  title: ['type', 'text', 'align', 'text_color', 'tap_action', 'hold_action', 'double_tap_action', 'active_highlight', 'class', 'id', 'card_mod'],
  clock: ['type', 'format', 'timezone', 'align', 'text_color', 'tap_action', 'hold_action', 'double_tap_action', 'active_highlight', 'class', 'id', 'card_mod'],
  date: ['type', 'format', 'timezone', 'align', 'text_color', 'tap_action', 'hold_action', 'double_tap_action', 'active_highlight', 'class', 'id', 'card_mod'],
  divider: ['type', 'color', 'class', 'id', 'card_mod'],
  item: ['type', 'title', 'icon', 'abbr', 'text_color', 'icon_color', 'entity', 'tap_action', 'hold_action', 'double_tap_action', 'active_highlight', 'class', 'id', 'card_mod'],
  category: ['type', 'title', 'icon', 'abbr', 'text_color', 'icon_color', 'start_collapsed', 'guide_line', 'items', 'class', 'id', 'card_mod'],
  markdown: ['type', 'content', 'align', 'text_color', 'class', 'id', 'card_mod'],
  card: ['type', 'card', 'align', 'background', 'class', 'id', 'card_mod'],
} as const;

/** Fields accepted on the footer. */
export const FOOTER_FIELDS = ['divider', 'buttons', 'card', 'markdown', 'markdown_color', 'tap_action', 'hold_action', 'double_tap_action'] as const;

/** Fields accepted on a footer button, including inherited common fields. */
export const FOOTER_BUTTON_FIELDS = ['icon', 'icon_color', 'title', 'entity', 'tap_action', 'hold_action', 'double_tap_action', 'active_highlight', 'class', 'id', 'card_mod'] as const;

/** Allowed `align` values. */
export const ALIGNS = ['left', 'center', 'right'] as const;

/** Allowed sidebar `position` values. */
export const POSITIONS = ['left', 'right'] as const;

/** Allowed clock hour-format values. */
export const HOUR_FORMATS = ['12h', '24h'] as const;
