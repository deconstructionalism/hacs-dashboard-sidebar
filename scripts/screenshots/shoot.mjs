// Screenshots the visual editor for the docs. Bundles the editor with esbuild,
// mounts it in a headless Chromium via Playwright, drives it through each config
// area, and writes a PNG per area.
//
//   npm run docs:shots            regenerate docs/assets/editor/*.png (review, commit)
//   npm run docs:shots -- --check build + drive + shoot to a temp dir and assert
//                                 every expected image was produced (CI smoke test)
//
// Screenshots are committed by a human after eyeballing them. CI only runs the
// --check smoke test; it never commits images back (headless Linux renders fonts
// and icons differently from a Mac, so a byte-diff gate is not meaningful here).

import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdtempSync, mkdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

const check = process.argv.includes('--check');
const outFlag = process.argv.indexOf('--out');
const outDir = check
  ? mkdtempSync(join(tmpdir(), 'ds-shots-'))
  : outFlag >= 0
    ? resolve(process.argv[outFlag + 1])
    : resolve(root, 'docs/assets/editor');

// A realistic sidebar with something in every region, so each screenshot has
// content to show. Kept here (not read from the app) so the docs images stay
// stable and independent of any user config.
const DEMO = {
  position: 'left',
  width: 260,
  header: [
    { type: 'title', text: 'Home', align: 'center' },
    { type: 'clock', format: '%-I:%M %p', align: 'center' },
    { type: 'date', format: '%A, %B %-d', align: 'center' },
    { type: 'divider' },
  ],
  body: [
    {
      type: 'item',
      title: 'Living Room',
      icon: 'mdi:sofa',
      entity: 'light.living',
      tap_action: { action: 'toggle' },
    },
    {
      type: 'item',
      title: 'Front Door',
      icon: 'mdi:door',
      entity: 'lock.front',
      tap_action: { action: 'toggle' },
    },
    {
      type: 'category',
      title: 'Rooms',
      icon: 'mdi:floor-plan',
      items: [
        {
          title: 'Kitchen',
          icon: 'mdi:silverware-fork-knife',
          tap_action: { action: 'navigate', navigation_path: '/lovelace/kitchen' },
        },
        {
          title: 'Bedroom',
          icon: 'mdi:bed',
          tap_action: { action: 'navigate', navigation_path: '/lovelace/bedroom' },
        },
      ],
    },
    { type: 'markdown', content: '**72°** outside' },
  ],
  footer: {
    buttons: [
      {
        icon: 'mdi:cog',
        title: 'Settings',
        tap_action: { action: 'navigate', navigation_path: '/config' },
      },
      { icon: 'mdi:lightbulb', entity: 'light.living', tap_action: { action: 'toggle' } },
      { icon: 'mdi:power', tap_action: { action: 'toggle' } },
    ],
  },
};

// A standalone sidebar for the "what does it look like" hero shots. Deliberately
// exercises many element types at once: title, clock, date, dividers, items
// (toggle / more-info / navigate), a category with children, and a markdown
// block, over a footer button row.
const HERO = {
  position: 'left',
  width: 264,
  header: [
    { type: 'title', text: 'Home', align: 'center' },
    { type: 'clock', format: '%-I:%M %p', align: 'center' },
    { type: 'date', format: '%A, %B %-d', align: 'center' },
    { type: 'divider' },
  ],
  body: [
    {
      type: 'item',
      title: 'Living Room',
      icon: 'mdi:sofa',
      entity: 'light.living',
      tap_action: { action: 'toggle' },
    },
    {
      type: 'item',
      title: 'Front Door',
      icon: 'mdi:door',
      entity: 'lock.front',
      tap_action: { action: 'toggle' },
    },
    {
      type: 'item',
      title: 'Thermostat',
      icon: 'mdi:thermostat',
      tap_action: { action: 'more-info' },
    },
    {
      type: 'category',
      title: 'Rooms',
      icon: 'mdi:floor-plan',
      start_collapsed: false,
      items: [
        {
          title: 'Kitchen',
          icon: 'mdi:silverware-fork-knife',
          tap_action: { action: 'navigate', navigation_path: '/lovelace/kitchen' },
        },
        {
          title: 'Bedroom',
          icon: 'mdi:bed',
          tap_action: { action: 'navigate', navigation_path: '/lovelace/bedroom' },
        },
      ],
    },
    { type: 'divider' },
    { type: 'markdown', content: '**72°F** and sunny' },
  ],
  footer: {
    buttons: [
      { icon: 'mdi:home', tap_action: { action: 'navigate', navigation_path: '/lovelace/home' } },
      { icon: 'mdi:lightbulb-group', tap_action: { action: 'toggle' } },
      { icon: 'mdi:lock', tap_action: { action: 'toggle' } },
      { icon: 'mdi:cog', tap_action: { action: 'navigate', navigation_path: '/config' } },
    ],
  },
};

// Each shot: a filename and the driver steps to reach that state. `steps` runs
// in the page against the window.H helpers defined in the host HTML.
const SHOTS = [
  {
    name: 'settings',
    steps: async (H) => {
      await H.tab('Settings');
    },
  },
  {
    name: 'header-title',
    steps: async (H) => {
      await H.tab('Header');
      await H.selectLoc('header:0');
    },
  },
  {
    name: 'content-item',
    steps: async (H) => {
      await H.tab('Body');
      await H.selectLoc('body:0');
    },
  },
  {
    name: 'content-category',
    steps: async (H) => {
      await H.tab('Body');
      await H.selectLoc('body:2');
    },
  },
  {
    name: 'element-yaml',
    steps: async (H) => {
      await H.tab('Body');
      await H.selectLoc('body:0');
      await H.elementYaml();
    },
  },
  {
    name: 'footer-buttons',
    steps: async (H) => {
      await H.tab('Footer');
      await H.selectLoc('footer:btn:0');
    },
  },
  {
    name: 'collapsed',
    steps: async (H) => {
      await H.tab('Body');
      await H.collapse();
    },
  },
];

/** Bundle the editor (and the preview card) into one ESM string. */
const bundleEditor = async () => {
  const result = await build({
    stdin: {
      contents: [
        `import '${resolve(root, 'src/dashboard-sidebar.ts')}';`,
        `import '${resolve(root, 'src/editor/sidebar-editor.ts')}';`,
        // Expose every MDI path so the icon stub can resolve real icons by name.
        `import * as __mdi from '@mdi/js';`,
        `window.__MDI = __mdi;`,
      ].join('\n'),
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    target: 'es2021',
    tsconfig: resolve(root, 'tsconfig.json'),
    write: false,
    logLevel: 'silent',
  });
  return result.outputFiles[0].text;
};

/**
 * The host page. A light HA-like theme (so the editor's CSS variables resolve),
 * an `ha-icon` stub so icon slots read as icons, and a window.H driver API that
 * mirrors the browser-test helpers. The bundled editor is inlined so the page is
 * self-contained and loads over file:// with no module-CORS issues.
 */
const hostHtml = (editorJs) => {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  :root {
    color-scheme: light;
    --primary-color: #3f51b5;
    --accent-color: #ff9800;
    --primary-text-color: #212121;
    --secondary-text-color: #727272;
    --disabled-text-color: #bdbdbd;
    --divider-color: rgba(0, 0, 0, 0.12);
    --primary-background-color: #fafafa;
    --secondary-background-color: #e5e5e5;
    --card-background-color: #ffffff;
    --mdc-theme-primary: #3f51b5;
    --mdc-theme-secondary: #ff9800;
    --text-primary-color: #ffffff;
    --error-color: #db4437;
  }
  html, body { margin: 0; height: 100%; background: var(--secondary-background-color); }
  body {
    font-family: Roboto, -apple-system, 'Segoe UI', sans-serif;
    color: var(--primary-text-color);
  }
</style>
</head>
<body>
<dashboard-sidebar-editor></dashboard-sidebar-editor>
<script type="module">
${editorJs}

// HA's icon elements are not in this bundle. Stub them so they render the real
// MDI glyph: resolve the "mdi:name" icon attribute (or a raw path) to an SVG the
// stub styles itself inline, so it shows through the editor and preview shadow
// roots (document CSS would not reach inside them).
const mdiPath = (name) => {
  if (!name) return '';
  const key = 'mdi' + name.replace(/^mdi:/, '').split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  return (window.__MDI || {})[key] || '';
};
// Render only in connectedCallback (attributes are already set by then) and on
// property assignment. Do NOT use observedAttributes: attributeChangedCallback
// fires mid-instantiation and mutating the DOM there corrupts Lit's sibling
// text bindings (an empty <span> next to the icon).
class IconStub extends HTMLElement {
  set icon(v) { this._icon = v; if (this.isConnected) this._render(); }
  get icon() { return this._icon; }
  set path(v) { this._path = v; if (this.isConnected) this._render(); }
  get path() { return this._path; }
  connectedCallback() { this._render(); }
  _render() {
    const d = this._path || this.getAttribute('path') || mdiPath(this._icon || this.getAttribute('icon'));
    this.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);vertical-align:middle;flex:0 0 auto';
    this.innerHTML = d
      ? '<svg viewBox="0 0 24 24" style="width:100%;height:100%;fill:currentColor"><path d="' + d + '"></path></svg>'
      : '';
  }
}
for (const tag of ['ha-icon', 'ha-svg-icon']) {
  if (!customElements.get(tag)) customElements.define(tag, class extends IconStub {});
}

// The card builds markdown blocks and manual cards through HA's card helpers,
// absent here. Stub them so a markdown block renders its text (with basic bold);
// any other card falls back to a small labelled placeholder.
window.loadCardHelpers = async () => ({
  createCardElement: (cfg) => {
    const el = document.createElement('div');
    el.style.cssText = 'font:inherit;color:inherit';
    if (cfg.type === 'markdown') {
      el.innerHTML = String(cfg.content || '').replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
    } else {
      el.style.cssText += ';padding:12px;border-radius:10px;background:var(--secondary-background-color);text-align:center;opacity:.85';
      el.textContent = String(cfg.type || 'card').replace(/^custom:/, '') + ' card';
    }
    return el;
  },
});

const editorEl = () => document.querySelector('dashboard-sidebar-editor');
const previewEl = () => editorEl().shadowRoot.querySelector('.pv-frame dashboard-sidebar');
async function settle() {
  const el = editorEl();
  await el.updateComplete;
  const pv = previewEl();
  if (pv) await pv.updateComplete;
  await el.updateComplete;
}

window.H = {
  async mount(config) {
    const el = editorEl();
    el.config = config;
    await settle();
    return true;
  },
  async tab(label) {
    const el = editorEl();
    const btn = [...el.shadowRoot.querySelectorAll('.tab')].find((b) => b.textContent.trim() === label);
    btn.click();
    await settle();
  },
  async selectLoc(loc) {
    const pv = previewEl();
    const node = pv.shadowRoot.querySelector('[data-loc="' + loc + '"]');
    node.click();
    await settle();
  },
  async collapse() {
    editorEl().shadowRoot.querySelector('.pv-toggle').click();
    await settle();
  },
  async elementYaml() {
    const el = editorEl();
    el.shadowRoot.querySelector('.form-tools [title="More"]').click();
    await el.updateComplete;
    const item = [...el.shadowRoot.querySelectorAll('.add-menu-item')].find((b) => /Edit As YAML/.test(b.textContent));
    item.click();
    await settle();
  },
  // Mount a plain sidebar card (no editor) in a dashboard-like frame, for the
  // "what does it look like" hero shots.
  async sidebar(config, collapsed) {
    const ed = editorEl();
    if (ed) ed.remove();
    localStorage.clear();
    let hero = document.getElementById('hero');
    if (!hero) {
      hero = document.createElement('div');
      hero.id = 'hero';
      document.body.appendChild(hero);
    }
    hero.innerHTML = '';
    hero.style.cssText = 'display:inline-block;padding:28px';
    const frame = document.createElement('div');
    frame.style.cssText =
      'width:' + (collapsed ? 72 : 264) + 'px;height:600px;border-radius:14px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.22)';
    const card = document.createElement('dashboard-sidebar');
    frame.appendChild(card);
    hero.appendChild(frame);
    card.setConfig({ ...config, start_collapsed: !!collapsed });
    await card.updateComplete;
    await new Promise((r) => setTimeout(r, 60));
    await card.updateComplete;
    return true;
  },
};
</script>
</body>
</html>`;
};

const main = async () => {
  const editorJs = await bundleEditor();
  const html = hostHtml(editorJs);
  const htmlDir = mkdtempSync(join(tmpdir(), 'ds-host-'));
  const htmlPath = join(htmlDir, 'host.html');
  writeFileSync(htmlPath, html);
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1000, height: 900 },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + htmlPath);
  await page.waitForFunction(() => !!window.H);

  const written = [];
  for (const shot of SHOTS) {
    await page.evaluate((cfg) => window.H.mount(cfg), DEMO);
    // Serialize the shot's steps into the page against window.H.
    await page.evaluate(`(${shot.steps.toString()})(window.H)`);
    const path = join(outDir, shot.name + '.png');
    await page.locator('.panel').first().screenshot({ path });
    written.push({ name: shot.name, path });
  }

  // Hero shots: the actual rendered sidebar (not the editor), expanded and
  // collapsed, for the docs to show what the thing looks like.
  for (const [name, collapsed] of [
    ['sidebar-expanded', false],
    ['sidebar-collapsed', true],
  ]) {
    await page.evaluate(([cfg, col]) => window.H.sidebar(cfg, col), [HERO, collapsed]);
    const path = join(outDir, name + '.png');
    await page.locator('#hero').screenshot({ path });
    written.push({ name, path });
  }

  await browser.close();

  if (errors.length) {
    console.error('Page errors while shooting:\n' + errors.join('\n'));
    process.exit(1);
  }

  // Validate: every expected image exists and is non-trivial.
  let ok = true;
  for (const { name, path } of written) {
    const bytes = existsSync(path) ? statSync(path).size : 0;
    if (bytes < 2000) {
      console.error(`  ✗ ${name}.png missing or too small (${bytes} bytes)`);
      ok = false;
    } else {
      console.log(`  ✓ ${name}.png (${Math.round(bytes / 1024)} KB)`);
    }
  }
  if (!ok) process.exit(1);
  console.log(
    check
      ? `\nSmoke test passed (${written.length} images).`
      : `\nWrote ${written.length} images to ${outDir}`,
  );
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
