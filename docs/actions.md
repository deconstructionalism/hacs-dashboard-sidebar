# Actions

Interactive elements — **items**, **footer buttons**, **title/clock/date**, and
the **text footer** — support three gestures: `tap_action`, `hold_action`
(long press), and `double_tap_action`. Each is edited in its own collapsible
section in the editor, with a **Test Action** button for the actionable types.

## Action types

| Action | Keys | Does |
| --- | --- | --- |
| `none` | — | Nothing. |
| `toggle` | `entity` | Toggles the entity, using the right service per domain (lock/unlock, cover open/close, else turn_on/off). |
| `more-info` | `entity` | Opens the entity's more-info dialog. |
| `navigate` | `navigation_path` | Navigates to a dashboard path. |
| `url` | `url_path` | Opens a web address in a new tab. |
| `call-service` | `service`, `data`, `entity` | Calls a Home Assistant service. |

```yaml
tap_action:
  action: call-service
  service: light.turn_on
  entity: light.kitchen
  data:
    brightness_pct: 40
hold_action:
  action: more-info
  entity: light.kitchen
double_tap_action:
  action: navigate
  navigation_path: /lovelace/lights
```

The action's own `entity` takes precedence over the element's `entity`, so one
element can act on a different entity per gesture.

## Active-page highlight

An element whose **tap action navigates** is highlighted when it points at the
page you're currently on — the theme accent color, with a tinted pill on rows
and footer buttons. It matches an exact path or a sub-path (e.g. a link to
`/lovelace/home` highlights on `/lovelace/home/room`) and updates live as you
navigate.

Opt out per element with `active_highlight: false` (the editor shows a
**Highlight When Active** toggle under **Advanced**, only when the tap action is
navigate).

```yaml
- type: item
  title: Home
  icon: mdi:home
  active_highlight: false
  tap_action:
    action: navigate
    navigation_path: /lovelace/home
```
