# Design

The card injects a sidebar into the Lovelace layout that pushes the dashboard
view aside (it does not overlay). It is configured from a top level
`dashboard_sidebar` key on the dashboard config, read by a bootstrap that wraps
the main view in a flex container.

## Config schema

```yaml
dashboard_sidebar:
  position: left            # left | right (default left)
  width: 240                # expanded width in px (default 240)
  collapsed_width: 64       # collapsed strip width in px (default 64)
  start_collapsed: false    # initial state before any saved state
  clock: true               # show a digital clock
  clock_format: iso         # iso (HH:MM:SS) | locale (default locale)
  date: true                # show the date
  date_format: iso          # iso (YYYY-MM-DD) | locale (default locale)
  title: Home               # optional header title (templatable)
  items:
    - title: Overview       # an ITEM: has a tap_action
      icon: mdi:home
      icon_color: '{{ "amber" if is_state("light.x","on") else "grey" }}'
      text_color: var(--primary-text-color)
      tap_action:
        action: navigate
        navigation_path: /lovelace/0
    - title: Lights         # a CATEGORY: has items, no tap_action
      icon: mdi:lightbulb-group
      items:
        - title: Living Room
          tap_action:
            action: toggle
          # ...item fields
```

### Entries: items vs categories

An entry is a **category** if it has an `items` array (or `type: category`),
otherwise it is an **item** (or `type: item`). Categories hold items only;
nesting a category inside a category is rejected (one level).

- **Item** requires `title` and `tap_action`. Optional `icon`, `text_color`,
  `icon_color`. Every field except `tap_action` is templatable (Jinja).
- **Category** requires `title` and a non empty `items`. Optional `icon`.
  `title` and `icon` are templatable.
- `tap_action` is a standard Home Assistant action (navigate, url, toggle,
  perform-action / call-service, more-info, none). It is never templated.

## Collapse

A small round button straddles the edge the sidebar shares with the view (the
right edge when the sidebar is on the left, the left edge when on the right).
It toggles collapsed state, which is saved per dashboard path in localStorage.

- Expanded: full width, icon plus label rows; categories show a header then
  their items beneath.
- Collapsed: a narrow strip of top level entries, each shown as its icon or,
  when it has no icon, its 1 to 2 letter initials. Clicking a collapsed
  category opens a popover to the open side listing its items; clicking an
  item runs its action. The popover only exists in collapsed mode.

## Clock and date

- Expanded clock: `clock_format` iso gives `HH:MM:SS`, locale uses the HA
  locale time. Expanded date: iso gives `YYYY-MM-DD`, locale uses the HA
  locale date.
- Collapsed formats are fixed by the card, not the user: clock is `HH:MM`,
  date is `MM-DD`, both compact enough for the strip.

## Theming

The sidebar takes color, background, and font from the active theme through CSS
variables: `--primary-text-color`, `--card-background-color` falling back to
`--primary-background-color`, `--divider-color` for separators, `--primary-color`
for the active and accent color, and the theme body font. Nothing is hard
coded, so it matches the dashboard.

## Templating

Templatable fields are rendered by subscribing to Home Assistant's
`render_template` websocket, one subscription per unique template string.
Strings without `{{`, `{%`, or `{#` are treated as literals and never
subscribed. Results update live and re-render the affected fields.
