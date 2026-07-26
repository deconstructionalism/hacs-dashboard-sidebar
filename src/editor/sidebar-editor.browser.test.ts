import { expect, fixture, html } from '@open-wc/testing';

import type { DashboardSidebarConfig } from '../lib/types';
import type { DashboardSidebarEditor } from './sidebar-editor';
import './sidebar-editor';

/** A tap action reused across the fixtures. */
const TAP = { action: 'toggle' } as const;

/** A container with a populated left side and an absent right side. */
const container = (): DashboardSidebarConfig => ({
  left: {
    header: [{ type: 'title', text: 'Home' }],
    body: [{ type: 'item', title: 'A', tap_action: TAP }],
    footer: { buttons: [{ icon: 'mdi:cog', tap_action: TAP }] },
  },
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

/** Counts the block rows in a region. */
function bodyRows(el: DashboardSidebarEditor): number {
  return root(el).querySelectorAll('.region[data-region="body"] .row').length;
}

describe('<dashboard-sidebar-editor>', () => {
  it('renders two tabs and the three sections for the focused side', async () => {
    const el = await mount(container());
    expect(root(el).querySelectorAll('.tab').length).to.equal(2);
    expect(root(el).querySelectorAll('.region').length).to.equal(3);
    expect(bodyRows(el)).to.equal(1);
  });

  it('adds a block through the region add menu', async () => {
    const el = await mount(container());
    const before = bodyRows(el);
    const sel = root(el).querySelector(
      '.region[data-region="body"] select.add',
    ) as HTMLSelectElement;
    sel.value = 'divider';
    sel.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(bodyRows(el)).to.equal(before + 1);
  });

  it('removes a block', async () => {
    const el = await mount(container());
    const before = bodyRows(el);
    (
      root(el).querySelector('.region[data-region="body"] .row .danger') as HTMLButtonElement
    ).click();
    await el.updateComplete;
    expect(bodyRows(el)).to.equal(before - 1);
  });

  it('adds a sidebar to the empty side', async () => {
    const el = await mount(container());
    (root(el).querySelectorAll('.tab')[1] as HTMLButtonElement).click();
    await el.updateComplete;
    expect(root(el).querySelector('.empty')).to.exist;
    (root(el).querySelector('.empty .primary') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(root(el).querySelectorAll('.region').length).to.equal(3);
  });

  it('toggles the footer to a custom component', async () => {
    const el = await mount(container());
    const footerSelect = root(el)
      .querySelectorAll('.region')[2]
      .querySelector('select') as HTMLSelectElement;
    footerSelect.value = 'card';
    footerSelect.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(root(el).querySelector('textarea')).to.exist;
  });

  it('saves a valid container through onSave and closes', async () => {
    const el = await mount(container());
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
    expect(saved?.left).to.exist;
    expect(closed).to.equal(true);
  });

  it('surfaces errors and does not save an invalid config', async () => {
    const el = await mount({ left: {} } as DashboardSidebarConfig);
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
