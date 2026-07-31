# Dashboard Sidebar

A configurable sidebar for Home Assistant Lovelace dashboards. It docks to the
left or right of a dashboard view, pushes the view aside (rather than floating
over it), and is edited **in place** through a visual editor — no YAML required,
though everything it produces is plain YAML under a `dashboard_sidebar` key.

## Highlights

- **Three regions** — a pinned **header**, a scrolling **body**, and a pinned
  **footer**.
- **Rich elements** — title, clock, date, divider, tappable items, collapsible
  categories, a markdown/Jinja **Text** block, and **Manual Cards** (any
  Lovelace card).
- **Collapsible** — the whole sidebar collapses to a slim icon strip; items and
  categories fall back to icons, with hover popovers.
- **Actions** — tap, hold, and double-tap actions on interactive elements
  (toggle, more-info, navigate, URL, call-service), with an active-page
  highlight for navigation links.
- **Templating** — Jinja in text, icon, and color fields; full markdown +
  Jinja in Text blocks.
- **Styling** — per-element text/icon colors, a sidebar background, and
  [card-mod](https://github.com/thomasloven/lovelace-card-mod) at the whole
  sidebar and per-element level.
- **Visual editor** — a four-tab modal (Settings, Header, Content, Footer) with
  a live preview that mirrors the real sidebar, drag-to-reorder, and per-tab
  YAML editing.

## At a glance

```yaml
dashboard_sidebar:
  position: left
  header:
    - type: clock
      align: center
    - type: date
      align: center
    - type: title
      text: Hello Sam
      align: center
  body:
    - type: item
      title: Home
      icon: mdi:home
      tap_action:
        action: navigate
        navigation_path: /lovelace/home
  footer:
    buttons:
      - icon: mdi:lightbulb
        entity: light.kitchen
        tap_action:
          action: toggle
```

Head to **[Install & Add](install.md)** to get it onto a dashboard.
