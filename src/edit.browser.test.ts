import { expect, fixture, html } from '@open-wc/testing';

import type { DashboardSidebar } from './dashboard-sidebar';
import type { DashboardSidebarConfig } from './lib/types';
import './dashboard-sidebar';
import './editor/block-modal';

/** A tap action reused across the fixtures. */
const TAP = { action: 'toggle' } as const;

/** A config with a header, a body (item + category), and a footer button. */
const cfg = (): DashboardSidebarConfig => ({
  header: [{ type: 'title', text: 'Home' }],
  body: [
    { type: 'item', title: 'A', tap_action: TAP },
    { type: 'category', title: 'Rooms', items: [{ title: 'Kitchen', tap_action: TAP }] },
  ],
  footer: { buttons: [{ icon: 'mdi:cog', tap_action: TAP }] },
});

/** Mounts the element in edit mode with the given config. */
async function mount(config: DashboardSidebarConfig): Promise<DashboardSidebar> {
  const el = await fixture<DashboardSidebar>(html`<dashboard-sidebar></dashboard-sidebar>`);
  el.editMode = true;
  el.setConfig(config);
  await el.updateComplete;
  return el;
}

/** Returns the element's shadow root. */
function root(el: DashboardSidebar): ShadowRoot {
  return el.shadowRoot as ShadowRoot;
}

/** Counts the top-level edit blocks in the body region. */
function bodyBlocks(el: DashboardSidebar): number {
  return root(el).querySelectorAll('.region-body > .edit-block').length;
}

describe('<dashboard-sidebar> in-place editing', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders per-element controls, add menus, and footer editor', async () => {
    const el = await mount(cfg());
    expect(root(el).querySelectorAll('.edit-controls').length).to.be.greaterThan(0);
    expect(root(el).querySelector('.edit-handle')).to.exist;
    expect(root(el).querySelector('.region-header select.edit-add')).to.exist;
    expect(root(el).querySelector('.region-body select.edit-add')).to.exist;
    expect(root(el).querySelector('.edit-cat-items .edit-item')).to.exist;
    expect(root(el).querySelector('.edit-footer')).to.exist;
  });

  it('adds a block through the add menu and reports the change', async () => {
    const el = await mount(cfg());
    let changed = 0;
    el.addEventListener('dashboard-sidebar-config-changed', () => {
      changed += 1;
    });
    const before = bodyBlocks(el);
    const sel = root(el).querySelector('.region-body select.edit-add') as HTMLSelectElement;
    sel.value = 'divider';
    sel.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(changed).to.be.greaterThan(0);
    expect(bodyBlocks(el)).to.equal(before + 1);
  });

  it('deletes a block', async () => {
    const el = await mount(cfg());
    const before = bodyBlocks(el);
    (root(el).querySelector('.region-body > .edit-block .edit-del') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(bodyBlocks(el)).to.equal(before - 1);
  });

  it('opens the settings modal on edit and saves the change', async () => {
    const el = await mount(cfg());
    (root(el).querySelector('.region-header .edit-block .edit-ctl') as HTMLButtonElement).click();
    await el.updateComplete;
    const modal = root(el).querySelector('dashboard-sidebar-block-modal');
    expect(modal).to.exist;

    let changed = 0;
    el.addEventListener('dashboard-sidebar-config-changed', () => {
      changed += 1;
    });
    (modal?.shadowRoot?.querySelector('.primary') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(changed).to.be.greaterThan(0);
    expect(root(el).querySelector('dashboard-sidebar-block-modal')).to.not.exist;
  });

  it('adds an item to a category', async () => {
    const el = await mount(cfg());
    const before = root(el).querySelectorAll('.edit-cat-items .edit-item').length;
    const addItem = [...root(el).querySelectorAll('.edit-cat-items .edit-add-btn')].find((b) =>
      b.textContent?.includes('Add item'),
    ) as HTMLButtonElement;
    addItem.click();
    await el.updateComplete;
    expect(root(el).querySelectorAll('.edit-cat-items .edit-item').length).to.equal(before + 1);
  });
});
