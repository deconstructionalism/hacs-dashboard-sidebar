<!-- Auto-generated from src/lib/types.ts by scripts/gen-config-docs.js.
     Do not edit by hand: run `npm run docs:config` to regenerate. -->

# Configuration reference

Every option the card accepts, generated straight from the source. Each block in `header` or `body` is one of the block types below, chosen by its `type` field. A field with **yes** in the Required column must be present; everything else is optional.

## Top-level configuration

The full configuration read from the Lovelace `dashboard_sidebar` key.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `position` | `SidebarPosition` | no | Edge the sidebar docks to. Default left. |
| `width` | `number` | no | Expanded width in pixels. Default 240. |
| `start_collapsed` | `boolean` | no | Whether the sidebar starts collapsed, before any stored preference. |
| `hide_on_mobile` | `boolean` | no | Hide the sidebar on narrow (mobile) viewports. |
| `background` | `string` | no | Sidebar background: any CSS `background` value (color, gradient, image, …), applied as the `background` shorthand. Defaults to the theme card background. |
| `header` | `SidebarBlock[]` | no | Blocks pinned to the top, above the scrolling body. |
| `body` | `SidebarBlock[]` | no | Blocks in the scrolling region below the header. |
| `footer` | `FooterConfig` | no | The bottom bar configuration. |
| `card_mod` | `Record<string, unknown>` | no | Passed to the card-mod integration (when installed) to style the sidebar. Target the dashboard-sidebar-* classes on the rendered elements. |

## Common fields (every block and footer button)

CSS targeting hooks shared by every block and footer button.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `class` | `string` | no | Extra CSS class(es) added to the rendered root, alongside the built-in dashboard-sidebar-* classes, so card-mod can target this one element. |
| `id` | `string` | no | CSS id set on the rendered root, so card-mod can target this one element. |
| `card_mod` | `Record<string, unknown>` | no | Per-element card-mod config (a `{ style, class, ... }` object), applied to this element's rendered root via the card-mod integration when installed. |

## Title block

Set `type: title` to use this block.

A heading block showing templatable text. Hidden while collapsed.

Also accepts the [Common fields (every block and footer button)](#common-fields-every-block-and-footer-button) below.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `'title'` | yes | Block discriminator. |
| `text` | `MaybeTemplate` | yes | The heading text. Templatable. |
| `align` | `Align` | no | Horizontal alignment. Default center. |
| `text_color` | `MaybeTemplate` | no | Optional text color, any CSS color. Templatable. |
| `tap_action` | `ActionConfig` | no | Optional action performed when tapped. Not templatable. |
| `hold_action` | `ActionConfig` | no | Optional action performed when held. Not templatable. |
| `double_tap_action` | `ActionConfig` | no | Optional action performed when double-tapped. Not templatable. |
| `active_highlight` | `boolean` | no | Whether to highlight this element while its navigate tap action targets the current page. Default true; set false to disable the active highlight. |

## Clock block

Set `type: clock` to use this block.

A digital clock block.

Also accepts the [Common fields (every block and footer button)](#common-fields-every-block-and-footer-button) below.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `'clock'` | yes | Block discriminator. |
| `format` | `TimeFormat` | no | An strftime pattern for the time. One of the presets (`%-I:%M %p`, `%H:%M`, `%-I:%M:%S %p`, `%H:%M:%S`) or any custom pattern. Empty defaults to `%H:%M`. |
| `timezone` | `string` | no | IANA time zone to render in; empty uses the system zone. |
| `align` | `Align` | no | Horizontal alignment. Default center. |
| `text_color` | `MaybeTemplate` | no | Optional text color, any CSS color. Templatable. |
| `tap_action` | `ActionConfig` | no | Optional action performed when tapped. Not templatable. |
| `hold_action` | `ActionConfig` | no | Optional action performed when held. Not templatable. |
| `double_tap_action` | `ActionConfig` | no | Optional action performed when double-tapped. Not templatable. |
| `active_highlight` | `boolean` | no | Whether to highlight this element while its navigate tap action targets the current page. Default true; set false to disable the active highlight. |

## Date block

Set `type: date` to use this block.

A date block.

Also accepts the [Common fields (every block and footer button)](#common-fields-every-block-and-footer-button) below.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `'date'` | yes | Block discriminator. |
| `format` | `DateFormat` | no | An strftime pattern (a preset or a custom one); empty uses the locale date. |
| `timezone` | `string` | no | IANA time zone to render in; empty uses the system zone. |
| `align` | `Align` | no | Horizontal alignment. Default center. |
| `text_color` | `MaybeTemplate` | no | Optional text color, any CSS color. Templatable. |
| `tap_action` | `ActionConfig` | no | Optional action performed when tapped. Not templatable. |
| `hold_action` | `ActionConfig` | no | Optional action performed when held. Not templatable. |
| `double_tap_action` | `ActionConfig` | no | Optional action performed when double-tapped. Not templatable. |
| `active_highlight` | `boolean` | no | Whether to highlight this element while its navigate tap action targets the current page. Default true; set false to disable the active highlight. |

## Divider block

Set `type: divider` to use this block.

A horizontal rule block.

Also accepts the [Common fields (every block and footer button)](#common-fields-every-block-and-footer-button) below.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `'divider'` | yes | Block discriminator. |
| `color` | `MaybeTemplate` | no | Optional line color, any CSS color. Templatable. |

## Item block

Set `type: item` to use this block.

A single tappable row. Standalone in a region, or nested in a category.

Also accepts the [Common fields (every block and footer button)](#common-fields-every-block-and-footer-button) below.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `'item'` | no | Block discriminator. Optional inside a category's item list. |
| `title` | `MaybeTemplate` | yes | Row label. Templatable. |
| `icon` | `MaybeTemplate` | no | Optional mdi icon shown before the label. Templatable. |
| `abbr` | `string` | no | Collapsed glyph override, used only when no icon is set. Defaults to the initials of the title; set it to disambiguate colliding initials. |
| `text_color` | `MaybeTemplate` | no | Optional label color, any CSS color. Templatable. |
| `icon_color` | `MaybeTemplate` | no | Optional icon color, any CSS color. Templatable. |
| `entity` | `string` | no | Target entity for toggle / more-info actions. Not templatable. |
| `tap_action` | `ActionConfig` | yes | Action performed when the row is tapped. Not templatable. |
| `hold_action` | `ActionConfig` | no | Optional action performed when held. Not templatable. |
| `double_tap_action` | `ActionConfig` | no | Optional action performed when double-tapped. Not templatable. |
| `active_highlight` | `boolean` | no | Whether to highlight this element while its navigate tap action targets the current page. Default true; set false to disable the active highlight. |

## Category block

Set `type: category` to use this block.

A collapsible group of items, nested one level deep.

Also accepts the [Common fields (every block and footer button)](#common-fields-every-block-and-footer-button) below.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `'category'` | yes | Block discriminator. |
| `title` | `MaybeTemplate` | yes | Group heading text. Templatable. |
| `icon` | `MaybeTemplate` | no | Optional mdi icon shown before the heading. Templatable. |
| `abbr` | `string` | no | Collapsed glyph override, used only when no icon is set. Defaults to the initials of the title; set it to disambiguate colliding initials. |
| `text_color` | `MaybeTemplate` | no | Optional heading text color, any CSS color. Templatable. |
| `icon_color` | `MaybeTemplate` | no | Optional heading icon color, any CSS color. Templatable. |
| `start_collapsed` | `boolean` | no | Whether the group starts collapsed when the sidebar is expanded. |
| `guide_line` | `boolean` | no | Whether to draw the vertical guide line beside the items. Default true. |
| `items` | `ItemBlock[]` | yes | The rows in this group. Categories cannot nest further. |

## Markdown block

Set `type: markdown` to use this block.

A markdown block: Home Assistant markdown with Jinja templating.

Also accepts the [Common fields (every block and footer button)](#common-fields-every-block-and-footer-button) below.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `'markdown'` | yes | Block discriminator. |
| `content` | `MaybeTemplate` | yes | Markdown content; Jinja templates resolve at runtime. Templatable. |
| `align` | `Align` | no | Horizontal alignment. Default left. |
| `text_color` | `MaybeTemplate` | no | Optional text color, any CSS color. Templatable. |

## Card block

Set `type: card` to use this block.

A manual card block: any Lovelace card, authored as YAML.

Also accepts the [Common fields (every block and footer button)](#common-fields-every-block-and-footer-button) below.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `'card'` | yes | Block discriminator. |
| `card` | `LovelaceCardConfig` | yes | Any Lovelace card config. |
| `align` | `Align` | no | Horizontal alignment of the card. Default left. |
| `background` | `string` | no | Card background, any CSS `background` value. |

## Footer

The bottom bar. Exactly one of `buttons`, `card`, or `markdown`: an ordered set of icon buttons (with overflow into a dots menu), a single manual card, or a markdown block. A card or markdown footer shows no dots menu and is hidden while collapsed.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `divider` | `boolean` | no | Whether the footer shows its top divider bar. Default true. |
| `buttons` | `FooterButtonConfig[]` | no | Ordered icon buttons. Mutually exclusive with `card`/`markdown`. |
| `card` | `LovelaceCardConfig` | no | A manual Lovelace card, replacing the buttons. |
| `markdown` | `MaybeTemplate` | no | Markdown content with Jinja templating, replacing the buttons. Templatable. |
| `markdown_color` | `MaybeTemplate` | no | Optional text color for the markdown footer, any CSS color. Templatable. |
| `tap_action` | `ActionConfig` | no | Action fired when the text (markdown) footer is tapped. Not templatable. |
| `hold_action` | `ActionConfig` | no | Action fired when the text (markdown) footer is held. Not templatable. |
| `double_tap_action` | `ActionConfig` | no | Action fired when the text (markdown) footer is double-tapped. Not templatable. |

## Footer button

An icon button in the footer's button bar.

Also accepts the [Common fields (every block and footer button)](#common-fields-every-block-and-footer-button) below.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `icon` | `MaybeTemplate` | yes | mdi icon shown in the button. Templatable. |
| `icon_color` | `MaybeTemplate` | no | Optional icon color, any CSS color. Templatable. |
| `title` | `MaybeTemplate` | no | Optional tooltip / accessible label. Templatable. |
| `entity` | `string` | no | Target entity for toggle / more-info actions. Not templatable. |
| `tap_action` | `ActionConfig` | yes | Action performed when the button is tapped. Not templatable. |
| `hold_action` | `ActionConfig` | no | Optional action performed when held. Not templatable. |
| `double_tap_action` | `ActionConfig` | no | Optional action performed when double-tapped. Not templatable. |
| `active_highlight` | `boolean` | no | Whether to highlight this element while its navigate tap action targets the current page. Default true; set false to disable the active highlight. |

## Field types

The types used in the tables above.

### `MaybeTemplate`

`string`

A string that may contain a Jinja template. When it does it is resolved at runtime against Home Assistant; otherwise the literal string is used.

### `SidebarPosition`

`'left' | 'right'`

Which edge of the dashboard view the sidebar docks to.

### `Align`

`'left' | 'center' | 'right'`

Horizontal alignment applied to a text or card block.

### `TimeFormat`

`string`

Clock format: an alias (`iso` = %H:%M:%S, `24h` = %H:%M, `12h` = %-I:%M %p, `locale`) or a strftime pattern using only time tokens, e.g. `%-I:%M:%S %p`.

### `DateFormat`

`string`

Date format: an alias (`iso` = %Y-%m-%d, `locale`) or a strftime pattern using only date tokens, e.g. `%A, %B %-d` (names localize).

### `ClockHourFormat`

`'12h' | '24h'`

Clock hour convention applied to both the expanded and collapsed views.

### `SidebarBlock`

`| TitleBlock | ClockBlock | DateBlock | DividerBlock | ItemBlock | CategoryBlock | MarkdownBlock | CardBlock`

Any block that can appear in the header or body region.

### `BlockType`

`'title' | 'clock' | 'date' | 'divider' | 'item' | 'category' | 'markdown' | 'card'`

The discriminator value of every block kind.

### `Region`

`'header' | 'body'`

The two block regions, used as stable key prefixes for block state.
