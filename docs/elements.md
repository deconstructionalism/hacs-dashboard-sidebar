# Elements

Header and body regions hold an ordered list of elements. Each has a `type`.
Common options — `class`, `card_mod` (see [Styling](styling.md)), and an
`Abbreviation` on items/categories — live under each element's **Advanced**
section in the editor.

## Templating

- **Text, title, item titles, icons, and color fields** resolve to plain text,
  so only **Jinja** applies (not markdown), e.g. `{{ states('sensor.temp') }}`.
- **Text blocks** and the **text footer** render through Home Assistant's
  markdown card, so they support **markdown and Jinja**.

!!! warning "Current user"
    Home Assistant's server-side templates do not reliably expose the current
    user, so `{{ user }}` renders empty. The starter greeting bakes your name in
    at creation instead.

## Title

A heading of templatable text. Hidden while collapsed.

```yaml
- type: title
  text: Living Room
  align: center       # left | center | right
  text_color: '{{ "tomato" if is_state("alarm.x","triggered") else "" }}'
```

## Clock

A digital clock.

```yaml
- type: clock
  format: '%H:%M'     # preset or any strftime pattern; empty = 24h
  timezone: America/New_York   # optional; empty = system zone
  align: center
  text_color: var(--primary-color)
```

Presets: `2:30 PM`, `14:30`, `2:30:39 PM`, `14:30:39`. A custom strftime pattern
is set under **Advanced → Custom Format**.

## Date

```yaml
- type: date
  format: '%A, %B %-d'   # preset or strftime; empty = locale default
  timezone: America/New_York
  align: center
  text_color: '#8ab4f8'
```

The Format dropdown offers curated regional presets (ISO, US month-first,
day-first, dotted European, plus short/long/full variants).

## Divider

A horizontal rule.

```yaml
- type: divider
  color: var(--divider-color)   # optional line color; templatable
```

## Item

A tappable row. Standalone in a region, or nested in a category.

```yaml
- type: item
  title: Front Door
  icon: mdi:door                # templatable; falls back to initials/abbr collapsed
  entity: lock.front_door       # target for toggle / more-info
  text_color: '{{ "green" if is_state("lock.front_door","locked") else "red" }}'
  icon_color: var(--primary-color)
  tap_action:
    action: toggle
  # hold_action, double_tap_action — see Actions
  # Advanced: abbreviation (collapsed glyph when no icon), class, card_mod
```

See **[Actions](actions.md)** for tap/hold/double-tap and the active-page
highlight.

## Category

A collapsible group of items, nested one level deep.

```yaml
- type: category
  title: Rooms
  icon: mdi:floor-plan
  text_color: coral
  icon_color: navy
  start_collapsed: true   # default true
  guide_line: true        # vertical guide beside the items; default true
  items:
    - title: Kitchen
      tap_action: { action: navigate, navigation_path: /lovelace/kitchen }
    - title: Bedroom
      tap_action: { action: navigate, navigation_path: /lovelace/bedroom }
```

Collapsed, a category becomes an icon that opens a popover of its items.

## Text

Markdown with Jinja, rendered by Home Assistant's markdown card. Hidden while
collapsed.

```yaml
- type: markdown
  content: |
    **{{ states("sensor.temperature") }}°** outside
  align: left
  text_color: var(--secondary-text-color)
```

## Manual Card

Any Lovelace card, authored as YAML. Fills the sidebar width; keeps its own card
chrome. Validated live against Home Assistant's card registry.

```yaml
- type: card
  card:
    type: gauge
    entity: sensor.cpu
    # card_mod: { style: 'ha-card { padding: 8px }' }   # size/style via the card itself
```
