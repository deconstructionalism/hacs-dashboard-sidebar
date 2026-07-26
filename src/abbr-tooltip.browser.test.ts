import { expect, fixture, html } from '@open-wc/testing';

import type { DashboardSidebar } from './dashboard-sidebar';
import type { SidebarConfig } from './lib/types';
import './dashboard-sidebar';

/** Mounts a fresh element with the given config and waits for its render. */
async function mount(config: SidebarConfig): Promise<DashboardSidebar> {
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

describe('collapsed abbr and tooltip', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('uses the abbr override for the collapsed glyph', async () => {
    const el = await mount({
      start_collapsed: true,
      body: [{ type: 'item', title: 'Loft Room', abbr: 'Lo', tap_action: TAP }],
    });
    expect(root(el).querySelector('.dashboard-sidebar-initials')?.textContent?.trim()).to.equal(
      'Lo',
    );
  });

  it('preserves title casing in derived initials', async () => {
    const el = await mount({
      start_collapsed: true,
      body: [{ type: 'item', title: 'iPhone Hub', tap_action: TAP }],
    });
    expect(root(el).querySelector('.dashboard-sidebar-initials')?.textContent?.trim()).to.equal(
      'iH',
    );
  });

  it('shows a tooltip on hover over a collapsed item', async () => {
    const el = await mount({
      start_collapsed: true,
      body: [{ type: 'item', title: 'Kitchen', tap_action: TAP }],
    });
    const btn = root(el).querySelector('.dashboard-sidebar-item') as HTMLElement;
    btn.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    const tip = root(el).querySelector('.dashboard-sidebar-tooltip');
    expect(tip).to.exist;
    expect(tip?.textContent?.trim()).to.equal('Kitchen');

    btn.dispatchEvent(new MouseEvent('mouseleave'));
    await el.updateComplete;
    expect(root(el).querySelector('.dashboard-sidebar-tooltip')).to.not.exist;
  });

  it('shows no tooltip when hovering a labelled expanded item', async () => {
    const el = await mount({ body: [{ type: 'item', title: 'Kitchen', tap_action: TAP }] });
    const btn = root(el).querySelector('.dashboard-sidebar-item') as HTMLElement;
    btn.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(root(el).querySelector('.dashboard-sidebar-tooltip')).to.not.exist;
  });

  it('shows a tooltip on a footer button in the expanded state', async () => {
    const el = await mount({
      body: [{ type: 'item', title: 'A', tap_action: TAP }],
      footer: { buttons: [{ icon: 'mdi:cog', title: 'Settings', tap_action: TAP }] },
    });
    const btn = root(el).querySelector('.dashboard-sidebar-footer-btn') as HTMLElement;
    btn.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(root(el).querySelector('.dashboard-sidebar-tooltip')?.textContent?.trim()).to.equal(
      'Settings',
    );
  });

  it('shows a tooltip on the footer ellipsis in the collapsed state', async () => {
    const el = await mount({
      start_collapsed: true,
      body: [{ type: 'item', title: 'A', tap_action: TAP }],
      footer: { buttons: [{ icon: 'mdi:cog', tap_action: TAP }] },
    });
    const dots = root(el).querySelector('.dashboard-sidebar-footer-more') as HTMLElement;
    dots.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(root(el).querySelector('.dashboard-sidebar-tooltip')?.textContent?.trim()).to.equal(
      'More',
    );
  });

  it('suppresses the tooltip while the footer popover is open', async () => {
    const el = await mount({
      start_collapsed: true,
      body: [{ type: 'item', title: 'A', tap_action: TAP }],
      footer: { buttons: [{ icon: 'mdi:cog', tap_action: TAP }] },
    });
    const dots = root(el).querySelector('.dashboard-sidebar-footer-more') as HTMLElement;
    dots.click();
    await el.updateComplete;
    dots.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(root(el).querySelector('.dashboard-sidebar-footer-popover')).to.exist;
    expect(root(el).querySelector('.dashboard-sidebar-tooltip')).to.not.exist;
  });
});
