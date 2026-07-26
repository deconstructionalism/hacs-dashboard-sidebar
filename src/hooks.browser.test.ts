import { expect, fixture, html } from '@open-wc/testing';

import type { DashboardSidebar } from './dashboard-sidebar';
import type { DashboardSidebarConfig } from './lib/types';
import './dashboard-sidebar';

/** Mounts a fresh element with the given config and waits for its render. */
async function mount(config: DashboardSidebarConfig): Promise<DashboardSidebar> {
  const el = await fixture<DashboardSidebar>(html`<dashboard-sidebar></dashboard-sidebar>`);
  el.setConfig(config);
  await el.updateComplete;
  return el;
}

/** Returns the element's shadow root, asserting it exists. */
function root(el: DashboardSidebar): ShadowRoot {
  expect(el.shadowRoot).to.exist;
  return el.shadowRoot as ShadowRoot;
}

/** A tap action reused across the fixtures. */
const TAP = { action: 'toggle' } as const;

describe('per-block class and id hooks', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('applies class and id alongside the built-in classes', async () => {
    const el = await mount({
      header: [{ type: 'title', text: 'Home', class: 'my-title', id: 't1' }],
      body: [{ type: 'item', title: 'A', class: 'special row-x', id: 'home', tap_action: TAP }],
    });
    const title = root(el).querySelector('#t1');
    expect(title, 'title by id').to.exist;
    expect(title?.classList.contains('dashboard-sidebar-title')).to.equal(true);
    expect(title?.classList.contains('my-title')).to.equal(true);

    const item = root(el).querySelector('#home');
    expect(item, 'item by id').to.exist;
    expect(item?.classList.contains('dashboard-sidebar-item')).to.equal(true);
    expect(item?.classList.contains('special')).to.equal(true);
    expect(item?.classList.contains('row-x')).to.equal(true);
  });

  it('applies class and id to footer buttons', async () => {
    const el = await mount({
      body: [{ type: 'item', title: 'A', tap_action: TAP }],
      footer: { buttons: [{ icon: 'mdi:cog', id: 'cog', class: 'cog-btn', tap_action: TAP }] },
    });
    const btn = root(el).querySelector('#cog');
    expect(btn, 'footer button by id').to.exist;
    expect(btn?.classList.contains('dashboard-sidebar-footer-btn')).to.equal(true);
    expect(btn?.classList.contains('cog-btn')).to.equal(true);
  });
});
