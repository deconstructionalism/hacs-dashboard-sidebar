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

describe('<dashboard-sidebar-editor>', () => {
  it('renders the three sections', async () => {
    const el = await mount(cfg());
    expect(root(el).querySelectorAll('.region').length).to.equal(3);
    expect(root(el).querySelectorAll('select.add').length).to.equal(2);
  });

  it('adds a block through the body add menu', async () => {
    const el = await mount(cfg());
    const before = root(el).querySelectorAll('.rows > .row').length;
    const sel = root(el).querySelectorAll('select.add')[1] as HTMLSelectElement;
    sel.value = 'divider';
    sel.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(root(el).querySelectorAll('.rows > .row').length).to.equal(before + 1);
  });

  it('deletes a block', async () => {
    const el = await mount(cfg());
    const before = root(el).querySelectorAll('.rows > .row').length;
    (root(el).querySelector('.row .danger') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(root(el).querySelectorAll('.rows > .row').length).to.equal(before - 1);
  });

  it('expands a row to reveal its fields', async () => {
    const el = await mount(cfg());
    (root(el).querySelector('.row .icon') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(root(el).querySelector('.fields')).to.exist;
  });

  it('edits a category and shows its item list', async () => {
    const el = await mount(cfg());
    const catRow = [...root(el).querySelectorAll('.row')].find(
      (r) => r.querySelector('.rtype')?.textContent === 'category',
    ) as HTMLElement;
    (catRow.querySelector('.icon') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(root(el).querySelector('.subhead')?.textContent).to.contain('Items');
    const addItem = [...root(el).querySelectorAll('.add-btn')].find((b) =>
      b.textContent?.includes('Add item'),
    );
    expect(addItem).to.exist;
  });

  it('toggles the footer to a custom component', async () => {
    const el = await mount(cfg());
    const modeBtns = root(el).querySelectorAll('.mode');
    (modeBtns[1] as HTMLButtonElement).click();
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
    (root(el).querySelector('footer .primary') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(saved?.body?.length).to.equal(2);
    expect(closed).to.equal(true);
  });

  it('surfaces errors and does not save an invalid config', async () => {
    const el = await mount({} as DashboardSidebarConfig);
    let saved = false;
    el.onSave = () => {
      saved = true;
    };
    (root(el).querySelector('footer .primary') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(root(el).querySelector('.errors')).to.exist;
    expect(saved).to.equal(false);
  });
});
