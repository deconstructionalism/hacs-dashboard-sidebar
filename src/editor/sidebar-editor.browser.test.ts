import { expect, fixture, html } from '@open-wc/testing';

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

/** Clicks the tab with the given label and settles the render. */
async function tab(el: DashboardSidebarEditor, label: string): Promise<void> {
  const btn = [...root(el).querySelectorAll('.tab')].find(
    (b) => b.textContent?.trim() === label,
  ) as HTMLButtonElement;
  btn.click();
  await el.updateComplete;
}

describe('<dashboard-sidebar-editor>', () => {
  it('renders the four tabs', async () => {
    const el = await mount(cfg());
    const labels = [...root(el).querySelectorAll('.tab')].map((b) => b.textContent?.trim());
    expect(labels).to.deep.equal(['Settings', 'Header', 'Content', 'Footer']);
  });

  it('renders a sortable preview list with drag handles', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    expect(root(el).querySelector('.pv-list[data-sort="body"]')).to.exist;
    expect(root(el).querySelectorAll('.pv-node .drag').length).to.be.greaterThan(0);
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

  it('adds a block through the Content add menu', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    const before = root(el).querySelectorAll('.pv-list[data-sort="body"] > .pv-node').length;
    // Nothing is auto-selected, so pick an element to reveal its "Add Below" control.
    (root(el).querySelector('.pv-list[data-sort="body"] > .pv-node') as HTMLElement).click();
    await el.updateComplete;
    (root(el).querySelector('.form .add') as HTMLButtonElement).click();
    await el.updateComplete;
    const divider = [...root(el).querySelectorAll('.add-menu-item')].find(
      (b) => b.textContent?.trim() === 'Divider',
    ) as HTMLButtonElement;
    divider.click();
    await el.updateComplete;
    expect(root(el).querySelectorAll('.pv-list[data-sort="body"] > .pv-node').length).to.equal(
      before + 1,
    );
  });

  it('deletes the selected block from its form', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    const before = root(el).querySelectorAll('.pv-list[data-sort="body"] > .pv-node').length;
    (root(el).querySelector('.pv-list[data-sort="body"] > .pv-node') as HTMLElement).click();
    await el.updateComplete;
    (root(el).querySelector('.form .danger') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(root(el).querySelectorAll('.pv-list[data-sort="body"] > .pv-node').length).to.equal(
      before - 1,
    );
  });

  it('selects nothing on landing and shows the hint', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    expect(root(el).querySelector('.form')).to.not.exist;
    expect(root(el).querySelector('.hint')?.textContent).to.contain('Select an element');
  });

  it('selecting a preview node reveals its edit form', async () => {
    const el = await mount(cfg());
    await tab(el, 'Header');
    (root(el).querySelector('.pv-list[data-sort="header"] > .pv-node') as HTMLElement).click();
    await el.updateComplete;
    expect(root(el).querySelector('.form')).to.exist;
    expect(root(el).querySelector('.advanced')).to.exist;
  });

  it('shows category items in the preview and offers add-item when selected', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    expect(root(el).querySelector('.pv-sublist .pv-subnode')).to.exist;
    (root(el).querySelector('.pv-cat-head') as HTMLElement).click();
    await el.updateComplete;
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

  it('shows a Preview header and toggles the collapsed look', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    expect(root(el).querySelector('.preview-title')?.textContent?.trim()).to.equal('Preview');
    expect(root(el).querySelector('.pv-frame.collapsed')).to.not.exist;
    (root(el).querySelector('.pv-toggle') as HTMLButtonElement).click();
    await el.updateComplete;
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
