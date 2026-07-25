# Dashboard Sidebar

A collapsible dashboard sidebar card for Home Assistant Lovelace — navigation,
clock, and custom content in a side rail that collapses to an icon strip.

> Status: **early scaffold.** The build/lint/release tooling is in place and the
> card registers and renders; the sidebar injection and collapse behavior are
> being built out.

## Development

```bash
npm install        # install toolchain
npm run build      # bundle to dist/dashboard-sidebar-card.js
npm run watch      # rebuild on change (with sourcemaps)
npm run lint       # eslint (TS) + stylelint (CSS-in-JS)
npm run format     # prettier check
npm run check      # lint + format + build
```

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
