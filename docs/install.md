# Install & Add

## Before you start

This card installs through **[HACS](https://hacs.xyz/)** (the Home Assistant
Community Store), a one-time add-on you set up separately. If you do not have
HACS yet, follow its **[installation guide](https://hacs.xyz/docs/use/)** first,
then come back here.

## Install via HACS

Dashboard Sidebar is a dashboard **card** (a small piece of frontend code), so
HACS installs it as a *Dashboard* item rather than a normal integration. HACS
downloads it and makes it load on every dashboard.

1. Open **HACS** from the Home Assistant sidebar.
2. Click the **⋮** menu (top right) and choose **Custom repositories**.
3. Paste `https://github.com/deconstructionalism/hacs-dashboard-sidebar` in the
   **Repository** field, pick **Dashboard** as the type, and click **Add**.
4. Search HACS for **Dashboard Sidebar**, open it, and click **Download**.
5. **Hard-refresh** your browser so the new code loads: **Ctrl+Shift+R**
   (**Cmd+Shift+R** on a Mac).

!!! note "Not using HACS?"
    Download `dashboard-sidebar-card.js` from the latest
    [release](https://github.com/deconstructionalism/hacs-dashboard-sidebar/releases)
    and copy it to `/config/www/`. Then in Home Assistant go to
    **Settings > Dashboards > (⋮) > Resources**, add
    `/local/dashboard-sidebar-card.js`, and set the type to **JavaScript Module**.

## Add a sidebar to a dashboard

The sidebar is configured **per dashboard** (it lives in that dashboard's
Lovelace config under `dashboard_sidebar`).

1. Open the dashboard you want it on.
2. Enter **edit mode** (pencil, or ⋮ → *Edit dashboard*).
3. A floating **＋ Sidebar** button appears at the bottom-left (it only shows on
   a dashboard that doesn't have a sidebar yet).
4. Click it. This seeds a **starter sidebar** tailored to your instance and the
   sidebar appears; the pencil on it opens the editor.

!!! warning "Editing the default Overview dashboard"
    Home Assistant's auto-generated **Overview** dashboard is read-only until you
    **Take control** of it (Home Assistant prompts for this the first time you
    edit). If edits or the **＋ Sidebar** button do not stick, take control first,
    or add a **new dashboard** (Settings > Dashboards > Add dashboard) and put the
    sidebar there.

!!! tip "No button?"
    The button only shows in **edit mode** on a dashboard **without** a sidebar.
    If a dashboard already has one, it just builds the sidebar instead. To start
    fresh, add a new dashboard, or remove the `dashboard_sidebar:` block from the
    current dashboard's **Raw configuration editor**.

### YAML-mode dashboards (no edit button)

A dashboard in **YAML mode** has no edit button, so the **＋ Sidebar** button
never appears. Add the sidebar by editing the dashboard's YAML directly:

1. **Load the resource in YAML.** YAML-mode dashboards do not read the UI
   resource registry, so declare the module in the dashboard's own `resources:`
   list (use `/local/dashboard-sidebar-card.js` for a manual, non-HACS install):

    ```yaml
    resources:
      - url: /hacsfiles/hacs-dashboard-sidebar/dashboard-sidebar-card.js
        type: module
    ```

2. **Add a top-level `dashboard_sidebar:` key**, alongside `views:`:

    ```yaml
    title: Home
    resources:
      - url: /hacsfiles/hacs-dashboard-sidebar/dashboard-sidebar-card.js
        type: module
    dashboard_sidebar:
      header:
        - type: clock
          align: center
      body:
        - type: item
          title: Overview
          icon: mdi:home
          tap_action:
            action: navigate
            navigation_path: /lovelace/0
    views:
      - title: Home
        cards: []
    ```

Reload the dashboard. See the [Config Reference](reference.md) for every field
and [Sidebar Settings](configuration.md) for the options. There is no visual
editor for a YAML-mode dashboard, so edit the `dashboard_sidebar:` block by hand.

### The starter sidebar

The starter is built from your instance so you have something real to edit:

- **Header**: a centered clock, the date beneath it, and a `Hello <you>`
  greeting (your name, read from Home Assistant at creation time).
- **Body**: one navigation link per dashboard view, using each view's icon,
  with a **navigate** tap action (so the [active-page
  highlight](actions.md#active-page-highlight) works automatically).
- **Footer**: up to four of your lights as toggle buttons, tinted by state.

## Editing

Click the **pencil** on the sidebar (in dashboard edit mode) to open the editor
modal. It has four tabs (**Settings**, **Header**, **Body**, **Footer**), each
named for the config key it edits, and each with a **live preview** on the right
that mirrors the real sidebar. Select any element in the preview to edit it, drag
to reorder, and use each tab's **⋯** menu to switch between the UI form and raw
**YAML** editing.

Everything is saved back into the dashboard's Lovelace config; nothing is stored
outside it.
