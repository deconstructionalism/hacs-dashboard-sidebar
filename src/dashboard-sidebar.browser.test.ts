import { expect, fixture, html } from '@open-wc/testing';

import type { DashboardSidebar } from './dashboard-sidebar';
import './dashboard-sidebar';

describe('<dashboard-sidebar>', () => {
  beforeEach(() => {
    // The collapsed state persists per view; clear it so tests do not bleed.
    window.localStorage.clear();
  });

  it('renders the header, menu, and footer for a valid config', async () => {
    const el = await fixture<DashboardSidebar>(html`<dashboard-sidebar></dashboard-sidebar>`);
    el.setConfig({
      title: 'Home',
      clock: true,
      items: [
        { title: 'Home', icon: 'mdi:home', tap_action: { action: 'toggle' } },
        { type: 'divider' },
        {
          title: 'Rooms',
          icon: 'mdi:floor-plan',
          items: [{ title: 'Kitchen', tap_action: { action: 'toggle' } }],
        },
      ],
      footer_buttons: [{ icon: 'mdi:cog', tap_action: { action: 'toggle' } }],
    });
    await el.updateComplete;

    const root = el.shadowRoot;
    expect(root).to.exist;
    expect(root!.querySelector('.dashboard-sidebar-header')).to.exist;
    expect(root!.querySelector('.dashboard-sidebar-title')?.textContent).to.contain('Home');
    expect(root!.querySelector('.dashboard-sidebar-clock')).to.exist;
    expect(root!.querySelectorAll('.dashboard-sidebar-item').length).to.be.greaterThan(0);
    expect(root!.querySelector('.dashboard-sidebar-divider')).to.exist;
    expect(root!.querySelector('.dashboard-sidebar-category')).to.exist;
    expect(root!.querySelector('.dashboard-sidebar-footer')).to.exist;
    expect(root!.querySelector('.dashboard-sidebar-footer-btn')).to.exist;
  });

  it('toggles the collapsed class and fires the toggle event', async () => {
    const el = await fixture<DashboardSidebar>(html`<dashboard-sidebar></dashboard-sidebar>`);
    el.setConfig({ items: [{ title: 'Home', tap_action: { action: 'toggle' } }] });
    await el.updateComplete;

    let fired = false;
    el.addEventListener('dashboard-sidebar-toggle', () => {
      fired = true;
    });

    const sidebar = el.shadowRoot!.querySelector('.sidebar');
    expect(sidebar!.classList.contains('collapsed')).to.equal(false);

    (el.shadowRoot!.querySelector('.dashboard-sidebar-toggle') as HTMLButtonElement).click();
    await el.updateComplete;

    expect(sidebar!.classList.contains('collapsed')).to.equal(true);
    expect(fired).to.equal(true);
  });

  it('shows the config-error panel for an invalid config', async () => {
    const el = await fixture<DashboardSidebar>(html`<dashboard-sidebar></dashboard-sidebar>`);
    el.setConfig({ items: 'nope' } as unknown as Parameters<DashboardSidebar['setConfig']>[0]);
    await el.updateComplete;

    const panel = el.shadowRoot!.querySelector('.config-error');
    expect(panel).to.exist;
    expect(panel!.textContent).to.contain('items: must be a list');
  });
});
