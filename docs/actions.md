# Actions

Interactive elements — **items**, **footer buttons**, **title/clock/date**, and
the **text footer** — support three gestures: `tap_action`, `hold_action`
(long press), and `double_tap_action`.

=== "Visual editor"

    Each gesture has its own collapsible section on the element, with a **Test
    Action** button for the actionable types. Choose an **Action** from the
    dropdown and fill in the keys it needs (entity, path, service, and so on).

=== "YAML"

    Each gesture is a mapping with an `action` key plus whatever that action
    needs. See the table below for the keys per action.

## Action types

| Action | Keys | Does |
| --- | --- | --- |
| `none` | — | Nothing. |
| `toggle` | `entity` | Toggles the entity, using the right service per domain (lock/unlock, cover open/close, else turn_on/off). |
| `more-info` | `entity` | Opens the entity's more-info dialog. |
| `navigate` | `navigation_path` | Navigates to a dashboard path. |
| `url` | `url_path` | Opens a web address in a new tab. |
| `call-service` | `service`, `data`, `entity` | Calls a Home Assistant service. |

=== "Visual editor"

    Pick the action in each gesture's section. For **call-service**, set the
    service and its data; the action's own **Entity** field overrides the
    element's entity, so one element can act on a different entity per gesture.

=== "YAML"

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

=== "Visual editor"

    Opt out per element with the **Highlight When Active** toggle under
    **Advanced** — it appears only when the tap action is navigate.

=== "YAML"

    ```yaml
    - type: item
      title: Home
      icon: mdi:home
      active_highlight: false
      tap_action:
        action: navigate
        navigation_path: /lovelace/home
    ```
