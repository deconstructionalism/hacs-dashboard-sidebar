# Styling

## Colors

Most elements accept **text** and **icon** color templates — any CSS color, or a
Jinja template that resolves to one.

=== "Visual editor"

    Set **Text Color** / **Icon Color** on the element (under **Advanced** for the
    text blocks). Any CSS color or a Jinja template that resolves to one works.

=== "YAML"

    ```yaml
    - type: item
      title: Alarm
      icon: mdi:shield
      text_color: '{{ "red" if is_state("alarm_control_panel.home","triggered") else "" }}'
      icon_color: var(--primary-color)
    ```

| Element | Color options |
| --- | --- |
| Title, Clock, Date, Markdown | `text_color` |
| Item, Category | `text_color`, `icon_color` |
| Divider | `color` (the line) |
| Footer button | `icon_color` |
| Markdown footer | `markdown_color` |

## Background

The whole sidebar takes any CSS `background`, including gradients.

=== "Visual editor"

    Set **Background** under **Settings → Advanced**.

=== "YAML"

    ```yaml
    dashboard_sidebar:
      background: linear-gradient(180deg, #1b2735, #090a0f)
    ```

## card-mod

For full CSS control, Dashboard Sidebar integrates with the
[card-mod](https://github.com/thomasloven/lovelace-card-mod) integration (install
it via HACS). Card Mod is available at two levels, both edited under **Advanced →
Card Mod YAML**:

- **Whole sidebar** — Settings → Advanced. Styles the sidebar's shadow root;
  target the `dashboard-sidebar-*` classes below.
- **Per element** — each element's Advanced section. **Automatically scoped** to
  that one element, so a bare selector like `.dashboard-sidebar-item-label` only
  affects the element you are editing, not every element in the sidebar.

=== "Visual editor"

    Open the element (or **Settings** for the whole sidebar), expand
    **Advanced → Card Mod YAML**, and write your styles. The targetable classes
    are listed right under the field.

=== "YAML"

    ```yaml
    dashboard_sidebar:
      card_mod:
        style: |
          .dashboard-sidebar-item-label { font-weight: 600; }
          :host { border-right: 2px solid var(--primary-color); }
    ```

If card-mod is not installed, the Card Mod fields are hidden and replaced with a
prompt to install it.

## CSS class

Give an element a `class` as a stable hook to target it from the sidebar-level
Card Mod. This is a **YAML-only** field (the visual editor styles elements
through per-element Card Mod instead):

```yaml
body:
  - type: item
    title: Home
    class: nav-home
    tap_action: { action: navigate, navigation_path: /lovelace/home }
card_mod:
  style: |
    .nav-home { text-transform: uppercase; }
```

## Targetable classes

Every rendered element carries a stable class, listed in the editor under each
Card Mod field. Common ones:

| Class | Element |
| --- | --- |
| `:host` | the whole sidebar |
| `.dashboard-sidebar-header` / `-body` / `-footer` | the regions |
| `.dashboard-sidebar-title` / `-clock` / `-date` / `-divider` | those elements |
| `.dashboard-sidebar-item` (+ `-item-icon`, `-item-label`, `-initials`) | item rows |
| `.dashboard-sidebar-category` (+ `-category-header`, `-category-items`, `-chevron`) | categories |
| `.dashboard-sidebar-markdown` | Markdown blocks |
| `.dashboard-sidebar-content` | Card wrapper |
| `.dashboard-sidebar-footer-btn` (+ `-footer-icon`, `-footer-more`) | footer buttons |
| `.dashboard-sidebar-popover` / `-tooltip` | collapsed popover / tooltip |
