# Dashboard Sidebar

[![CI](https://github.com/deconstructionalism/hacs-dashboard-sidebar/actions/workflows/ci.yml/badge.svg)](https://github.com/deconstructionalism/hacs-dashboard-sidebar/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/deconstructionalism/hacs-dashboard-sidebar?sort=semver)](https://github.com/deconstructionalism/hacs-dashboard-sidebar/releases)
[![HACS: Dashboard](https://img.shields.io/badge/HACS-Dashboard-41BDF5.svg)](https://hacs.xyz)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A collapsible dashboard sidebar card for Home Assistant Lovelace: navigation,
clock, and custom content in a side rail that collapses to an icon strip. It is
edited in place through a four-tab visual editor (Settings, Header, Body,
Footer), and everything it produces is plain YAML under a `dashboard_sidebar` key.

📖 **[Documentation](https://deconstructionalism.github.io/hacs-dashboard-sidebar/)**: configuration reference, the visual editor, styling, and actions.

## Development

```bash
npm install        # install toolchain
npm run build      # bundle to dist/dashboard-sidebar-card.js
npm run watch      # rebuild on change (with sourcemaps)
npm run lint       # eslint (TS) + stylelint (CSS-in-JS)
npm run format     # prettier check
npm run test       # vitest (unit) + web-test-runner (browser)
npm run check      # lint + format + drift checks + unit tests + build (what CI runs)
```

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the full script list, the
architecture map, the "regenerate, don't hand-edit" rules for the generated
schema/reference, and the test conventions.

### Tooling

| Concern             | Tool                                             |
| ------------------- | ------------------------------------------------ |
| Language            | TypeScript (Lit 3, decorators)                   |
| Bundler             | Rollup (terser-minified ES module)               |
| TS/JS lint          | ESLint flat config + typescript-eslint + lit/wc  |
| CSS-in-JS lint      | Stylelint via `postcss-lit` (lints `css` blocks) |
| Formatting          | Prettier                                         |

`npm run lint:css` runs Stylelint against the `.ts` sources; `postcss-lit`
extracts the CSS inside Lit `` css`…` `` and `` html`<style>…` `` template
literals so the styles are linted like real CSS.

## Local testing in Home Assistant

1. `npm run build`
2. Copy `dist/dashboard-sidebar-card.js` to `/config/www/`
3. Add a dashboard resource pointing at
   `/local/dashboard-sidebar-card.js` (type: JavaScript Module)
4. Reference the card / sidebar config in your dashboard

## Installation via HACS

Add this repository as a custom repository (category: **Dashboard**), install,
and add the resource. The `Release` workflow builds the card and attaches
`dashboard-sidebar-card.js` to each published GitHub release, which is what
HACS downloads.

## License

MIT
