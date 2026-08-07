# Install & Add

## Install via HACS

Dashboard Sidebar ships as a **Lovelace dashboard resource** (a JavaScript
module), not a Python integration.

1. In **HACS**, add this repository as a custom repository of type
   **Dashboard** (until it is in the HACS default list):
   `https://github.com/deconstructionalism/hacs-dashboard-sidebar`.
2. Install it. HACS registers the resource
   (`/hacsfiles/hacs-dashboard-sidebar/dashboard-sidebar-card.js` or similar) so
   the module loads on every dashboard.
3. Hard-refresh your browser so the new resource loads.

!!! note "Manual resource"
    If you are not using HACS, copy `dashboard-sidebar-card.js` to
    `/config/www/` and add a **Dashboard resource** pointing at
    `/local/dashboard-sidebar-card.js` of type **JavaScript Module**.

## Add a sidebar to a dashboard

The sidebar is configured **per dashboard** (it lives in that dashboard's
Lovelace config under `dashboard_sidebar`).

1. Open the dashboard you want it on.
2. Enter **edit mode** (pencil, or ⋮ → *Edit dashboard*).
3. A floating **＋ Sidebar** button appears at the bottom-left (it only shows on
   a dashboard that doesn't have a sidebar yet).
4. Click it. This seeds a **starter sidebar** tailored to your instance and the
   sidebar appears; the pencil on it opens the editor.

!!! tip "No button?"
    The button only shows in **edit mode** on a dashboard **without** a sidebar.
    If a dashboard already has one, it just builds the sidebar instead. To start
    fresh, add a new dashboard, or remove the `dashboard_sidebar:` block from the
    current dashboard's **Raw configuration editor**.

### The starter sidebar

The starter is built from your instance so you have something real to edit:

- **Header** — a centered clock, the date beneath it, and a `Hello <you>`
  greeting (your name, read from Home Assistant at creation time).
- **Body** — one navigation link per dashboard view, using each view's icon,
  with a **navigate** tap action (so the [active-page
  highlight](actions.md#active-page-highlight) works automatically).
- **Footer** — up to four of your lights as toggle buttons, tinted by state.

## Editing

Click the **pencil** on the sidebar (in dashboard edit mode) to open the editor
modal. It has four tabs — **Settings**, **Header**, **Body**, **Footer** — each
named for the config key it edits, and each with a **live preview** on the right
that mirrors the real sidebar. Select any element in the preview to edit it, drag
to reorder, and use each tab's **⋯** menu to switch between the UI form and raw
**YAML** editing.

Everything is saved back into the dashboard's Lovelace config; nothing is stored
outside it.
