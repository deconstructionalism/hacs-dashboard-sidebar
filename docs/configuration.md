# Sidebar Settings

Sidebar-wide options live on the top level of the `dashboard_sidebar` config and
in the editor's **Settings** tab.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `position` | `left` \| `right` | `left` | Which edge the sidebar docks to. |
| `width` | number (px) | `280` | Expanded width. |
| `start_collapsed` | boolean | `false` | Load collapsed to the icon strip. |
| `hide_on_mobile` | boolean | `false` | Hide entirely on narrow (phone) screens. |
| `background` | CSS `background` | theme card bg | Any CSS background, including gradients. |
| `header` | list | — | Blocks pinned to the top. |
| `body` | list | — | Blocks in the scrolling region. |
| `footer` | mapping | — | The bottom bar (see [Footer](footer.md)). |
| `card_mod` | mapping | — | card-mod styling for the whole sidebar (see [Styling](styling.md)). |

```yaml
dashboard_sidebar:
  position: right
  width: 300
  start_collapsed: false
  hide_on_mobile: true
  background: linear-gradient(180deg, #1b2735, #090a0f)
  header: []
  body: []
  footer: {}
```

## Collapsing

The sidebar can collapse to a slim **icon strip** using the toggle on its edge;
the choice is remembered per browser. While collapsed:

- **Titles** and **Text** blocks are hidden.
- **Items** and **categories** show as icons (or their
  [abbreviation](elements.md#item) when they have no icon); hovering shows a
  tooltip, and a category opens a popover of its items.
- **Footer buttons** collapse into a single **⋯** menu.

## Regions

- **Header** — pinned to the top, never scrolls.
- **Body** — scrolls on its own when taller than the sidebar.
- **Footer** — pinned to the bottom, never scrolls.

Each region holds an ordered list of [elements](elements.md). In the editor,
the **Header** and **Content** tabs edit the header and body; the **Footer** tab
edits the footer.
