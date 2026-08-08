# Dashboard Sidebar

[![CI](https://github.com/deconstructionalism/homeassistant-dashboard-sidebar/actions/workflows/ci.yml/badge.svg)](https://github.com/deconstructionalism/homeassistant-dashboard-sidebar/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/deconstructionalism/homeassistant-dashboard-sidebar?sort=semver)](https://github.com/deconstructionalism/homeassistant-dashboard-sidebar/releases)
[![HACS: Dashboard](https://img.shields.io/badge/HACS-Dashboard-41BDF5.svg)](https://hacs.xyz)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A collapsible dashboard sidebar card for Home Assistant Lovelace: navigation,
clock, and custom content in a side rail that collapses to an icon strip. It is
edited in place through a four-tab visual editor (Settings, Header, Body,
Footer), and everything it produces is plain YAML under a `dashboard_sidebar` key.

📖 **[Documentation](https://deconstructionalism.github.io/homeassistant-dashboard-sidebar/)**: configuration reference, the visual editor, styling, and actions.

<img src="https://raw.githubusercontent.com/deconstructionalism/homeassistant-dashboard-sidebar/main/docs/assets/editor/sidebar-expanded.png" alt="The sidebar expanded, with a title, clock, date, navigation items, a Rooms group, and a footer button row" width="300">
<img src="https://raw.githubusercontent.com/deconstructionalism/homeassistant-dashboard-sidebar/main/docs/assets/editor/sidebar-collapsed.png" alt="The same sidebar collapsed to a slim icon strip" width="96">


## Installation

Install through **[HACS](https://hacs.xyz)**: add this repository as a custom
repository (category **Dashboard**), install it, then open a dashboard in edit
mode and use the **+ Sidebar** button. Full steps, including YAML-mode
dashboards, are in the
**[installation guide](https://deconstructionalism.github.io/homeassistant-dashboard-sidebar/install/)**.

Publishing a GitHub release builds the card and attaches
`dashboard-sidebar-card.js`, which is what HACS downloads.

## Contributing

Development setup, the script reference, the architecture map, and the
"regenerate, don't hand-edit" rules for the generated schema and config reference
are all in **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## License

MIT
