import { expect, fixture, html } from '@open-wc/testing';

import type { DashboardSidebar } from '../dashboard-sidebar';
import type { DashboardSidebarConfig } from '../lib/types';
import type { DashboardSidebarEditor } from './sidebar-editor';
import './sidebar-editor';

/** A tap action reused across the fixtures. */
const TAP = { action: 'toggle' } as const;

/** A config with header, body (item + category), and a footer button. */
const cfg = (): DashboardSidebarConfig => ({
  header: [{ type: 'title', text: 'Home' }],
  body: [
    { type: 'item', title: 'A', tap_action: TAP },
    { type: 'category', title: 'Rooms', items: [{ title: 'Kitchen', tap_action: TAP }] },
  ],
  footer: { buttons: [{ icon: 'mdi:cog', tap_action: TAP }] },
});

/** Mounts the editor with a config and waits for its first render. */
async function mount(config: DashboardSidebarConfig): Promise<DashboardSidebarEditor> {
  const el = await fixture<DashboardSidebarEditor>(
    html`<dashboard-sidebar-editor></dashboard-sidebar-editor>`,
  );
  el.config = config;
  await el.updateComplete;
  return el;
}

/** Returns the editor's shadow root. */
function root(el: DashboardSidebarEditor): ShadowRoot {
  return el.shadowRoot as ShadowRoot;
}

/** The live preview sidebar element in the current tab, or null. */
function preview(el: DashboardSidebarEditor): DashboardSidebar | null {
  return root(el).querySelector('.pv-frame dashboard-sidebar');
}

/** Waits for both the editor and its preview sidebar to finish rendering. */
async function settle(el: DashboardSidebarEditor): Promise<void> {
  await el.updateComplete;
  await preview(el)?.updateComplete;
  await el.updateComplete;
}

/** Clicks the tab with the given label and settles the render. */
async function tab(el: DashboardSidebarEditor, label: string): Promise<void> {
  const btn = [...root(el).querySelectorAll('.tab')].find(
    (b) => b.textContent?.trim() === label,
  ) as HTMLButtonElement;
  btn.click();
  await settle(el);
}

/** Clicks the preview element with the given data-loc, then settles. */
async function clickLoc(el: DashboardSidebarEditor, loc: string): Promise<void> {
  const node = preview(el)?.shadowRoot?.querySelector(`[data-loc="${loc}"]`) as HTMLElement;
  node.click();
  await settle(el);
}

/** Count of a preview region's top-level rows. */
function regionCount(el: DashboardSidebarEditor, region: string): number {
  return preview(el)?.shadowRoot?.querySelector(`.region-${region}`)?.children.length ?? 0;
}

describe('<dashboard-sidebar-editor>', () => {
  it('renders the four tabs', async () => {
    const el = await mount(cfg());
    const labels = [...root(el).querySelectorAll('.tab')].map((b) => b.textContent?.trim());
    expect(labels).to.deep.equal(['Settings', 'Header', 'Content', 'Footer']);
  });

  it('renders the region as a live sidebar preview', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    const sb = preview(el);
    expect(sb).to.exist;
    expect(sb?.preview).to.equal(true);
    // The body region renders its real rows with location markers.
    expect(sb?.shadowRoot?.querySelector('.region-body [data-loc="body:0"]')).to.exist;
    expect(sb?.shadowRoot?.querySelector('[data-loc="body:1"]')).to.exist;
  });

  it('edits sidebar settings (position via icon choice)', async () => {
    const el = await mount(cfg());
    await tab(el, 'Settings');
    (root(el).querySelectorAll('.settings .choice')[1] as HTMLButtonElement).click();
    await el.updateComplete;
    let saved: DashboardSidebarConfig | undefined;
    el.onSave = (c) => {
      saved = c;
    };
    (root(el).querySelector('footer .primary') as HTMLButtonElement).click();
    expect(saved?.position).to.equal('right');
  });

  it('adds a block below the selected element from its form', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    const before = regionCount(el, 'body');
    // Nothing is auto-selected, so pick an element to reveal its "Add Below".
    await clickLoc(el, 'body:0');
    (root(el).querySelector('.form .add') as HTMLButtonElement).click();
    await el.updateComplete;
    const divider = [...root(el).querySelectorAll('.add-menu-item')].find(
      (b) => b.textContent?.trim() === 'Divider',
    ) as HTMLButtonElement;
    divider.click();
    await settle(el);
    expect(regionCount(el, 'body')).to.equal(before + 1);
  });

  it('deletes the selected block from its form', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    const before = regionCount(el, 'body');
    await clickLoc(el, 'body:0');
    (root(el).querySelector('.form .danger') as HTMLButtonElement).click();
    await settle(el);
    expect(regionCount(el, 'body')).to.equal(before - 1);
  });

  it('selecting a preview element reveals its edit form', async () => {
    const el = await mount(cfg());
    await tab(el, 'Header');
    expect(root(el).querySelector('.form')).to.not.exist;
    await clickLoc(el, 'header:0');
    expect(root(el).querySelector('.form')).to.exist;
    expect(root(el).querySelector('.advanced')).to.exist;
  });

  it('reorders a region through a preview reorder event', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    let saved: DashboardSidebarConfig | undefined;
    el.onSave = (c) => {
      saved = c;
    };
    preview(el)?.dispatchEvent(
      new CustomEvent('dashboard-sidebar-preview-reorder', {
        detail: { from: 'body', to: 'body', oldIndex: 0, newIndex: 1 },
        bubbles: true,
        composed: true,
      }),
    );
    await settle(el);
    await tab(el, 'Settings');
    (root(el).querySelector('.settings input[type="checkbox"]') as HTMLInputElement).click();
    await el.updateComplete;
    (root(el).querySelector('footer .primary') as HTMLButtonElement).click();
    // The category that was second is now first.
    expect(saved?.body?.[0]?.type).to.equal('category');
  });

  it('shows category items in the preview and offers add-item when selected', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    // The category renders its items inline, each with a location marker.
    expect(preview(el)?.shadowRoot?.querySelector('[data-loc="body:1.0"]')).to.exist;
    await clickLoc(el, 'body:1');
    const addItem = [...root(el).querySelectorAll('.form .add-btn')].some((b) =>
      b.textContent?.includes('Add Sub-Item'),
    );
    expect(addItem).to.equal(true);
  });

  it('toggles the footer to a custom component', async () => {
    const el = await mount(cfg());
    await tab(el, 'Footer');
    (root(el).querySelectorAll('.mode')[1] as HTMLButtonElement).click();
    await el.updateComplete;
    expect(root(el).querySelector('textarea')).to.exist;
  });

  it('saves a valid config through onSave and closes', async () => {
    const el = await mount(cfg());
    let saved: DashboardSidebarConfig | undefined;
    let closed = false;
    el.onSave = (c) => {
      saved = c;
    };
    el.onClose = () => {
      closed = true;
    };
    // A change is required before Save is enabled.
    await tab(el, 'Settings');
    (root(el).querySelectorAll('.settings .choice')[1] as HTMLButtonElement).click();
    await el.updateComplete;
    (root(el).querySelector('footer .primary') as HTMLButtonElement).click();
    expect(saved?.body?.length).to.equal(2);
    expect(closed).to.equal(true);
  });

  it('surfaces errors and does not save an invalid config', async () => {
    const el = await mount({} as DashboardSidebarConfig);
    let saved = false;
    el.onSave = () => {
      saved = true;
    };
    // Make a change so Save is enabled, while the config stays invalid.
    await tab(el, 'Settings');
    (root(el).querySelector('.settings input[type="checkbox"]') as HTMLInputElement).click();
    await el.updateComplete;
    (root(el).querySelector('footer .primary') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(root(el).querySelector('.errors')).to.exist;
    expect(saved).to.equal(false);
  });

  it('disables Save until a change is made', async () => {
    const el = await mount(cfg());
    const save = (): HTMLButtonElement =>
      root(el).querySelector('footer .primary') as HTMLButtonElement;
    expect(save().disabled).to.equal(true);
    await tab(el, 'Settings');
    (root(el).querySelectorAll('.settings .choice')[1] as HTMLButtonElement).click();
    await el.updateComplete;
    expect(save().disabled).to.equal(false);
  });

  it('shows a field error on blur and disables Save', async () => {
    const el = await mount(cfg());
    await tab(el, 'Settings');
    const width = root(el).querySelector('.settings input[type="text"]') as HTMLInputElement;
    width.value = '0';
    width.dispatchEvent(new Event('input'));
    width.dispatchEvent(new Event('blur'));
    await el.updateComplete;
    expect(root(el).querySelector('.field-error')).to.exist;
    expect((root(el).querySelector('footer .primary') as HTMLButtonElement).disabled).to.equal(
      true,
    );
  });

  it('confirms before closing with unsaved changes', async () => {
    const el = await mount(cfg());
    let closed = false;
    el.onClose = () => {
      closed = true;
    };
    await tab(el, 'Settings');
    (root(el).querySelectorAll('.settings .choice')[1] as HTMLButtonElement).click();
    await el.updateComplete;
    (root(el).querySelector('footer button') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(root(el).querySelector('.confirm')).to.exist;
    expect(closed).to.equal(false);
    (root(el).querySelector('.danger-btn') as HTMLButtonElement).click();
    expect(closed).to.equal(true);
  });

  it('selects nothing on landing and shows the hint', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    expect(root(el).querySelector('.form')).to.not.exist;
    expect(root(el).querySelector('.hint')?.textContent).to.contain('Select an element');
  });

  it('shows a Preview header and toggles the collapsed look', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    expect(root(el).querySelector('.preview-title')?.textContent?.trim()).to.equal('Preview');
    expect(root(el).querySelector('.pv-frame.collapsed')).to.not.exist;
    (root(el).querySelector('.pv-toggle') as HTMLButtonElement).click();
    await settle(el);
    expect(root(el).querySelector('.pv-frame.collapsed')).to.exist;
  });

  it('toggles the footer top divider bar', async () => {
    const el = await mount(cfg());
    await tab(el, 'Footer');
    let saved: DashboardSidebarConfig | undefined;
    el.onSave = (c) => {
      saved = c;
    };
    (root(el).querySelector('.editor input[type="checkbox"]') as HTMLInputElement).click();
    await el.updateComplete;
    (root(el).querySelector('footer .primary') as HTMLButtonElement).click();
    expect(saved?.footer?.divider).to.equal(false);
  });
});
