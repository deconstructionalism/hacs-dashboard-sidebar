import { aTimeout, expect, fixture, html } from '@open-wc/testing';

import type { DashboardSidebar } from './dashboard-sidebar';
import type { DashboardSidebarConfig } from './lib/types';
import './dashboard-sidebar';

/**
 * Mounts a fresh element, applies the config, and waits for the first render.
 */
async function mount(config: DashboardSidebarConfig): Promise<DashboardSidebar> {
  const el = await fixture<DashboardSidebar>(html`<dashboard-sidebar></dashboard-sidebar>`);
  el.setConfig(config);
  await el.updateComplete;
  return el;
}

/**
 * Returns the element's shadow root, asserting it exists.
 */
function root(el: DashboardSidebar): ShadowRoot {
  expect(el.shadowRoot).to.exist;
  return el.shadowRoot as ShadowRoot;
}

/**
 * A tap action reused across item and footer fixtures.
 */
const TAP = { action: 'toggle' } as const;

describe('<dashboard-sidebar> config species', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('header', () => {
    it('renders title, clock, and date and honors header_align', async () => {
      const el = await mount({
        title: 'Home',
        clock: true,
        date: true,
        header_align: 'right',
        items: [{ title: 'A', tap_action: TAP }],
      });
      const header = root(el).querySelector('.dashboard-sidebar-header') as HTMLElement;
      expect(header).to.exist;
      expect(header.style.textAlign).to.equal('right');
      expect(root(el).querySelector('.dashboard-sidebar-title')?.textContent).to.contain('Home');
      expect(root(el).querySelector('.dashboard-sidebar-clock')).to.exist;
      expect(root(el).querySelector('.dashboard-sidebar-date')).to.exist;
    });

    it('applies a strftime clock format when expanded', async () => {
      const el = await mount({
        clock: true,
        clock_format: '%H:%M',
        items: [{ title: 'A', tap_action: TAP }],
      });
      const text = root(el).querySelector('.dashboard-sidebar-clock')?.textContent?.trim() ?? '';
      expect(text).to.match(/^\d{2}:\d{2}$/);
    });

    it('omits the header entirely when nothing is configured', async () => {
      const el = await mount({ items: [{ title: 'A', tap_action: TAP }] });
      expect(root(el).querySelector('.dashboard-sidebar-header')).to.not.exist;
    });
  });

  describe('position', () => {
    it('defaults to the left', async () => {
      const el = await mount({ items: [{ title: 'A', tap_action: TAP }] });
      expect(root(el).querySelector('.sidebar')?.classList.contains('pos-left')).to.equal(true);
    });

    it('docks right when configured', async () => {
      const el = await mount({ position: 'right', items: [{ title: 'A', tap_action: TAP }] });
      expect(root(el).querySelector('.sidebar')?.classList.contains('pos-right')).to.equal(true);
    });
  });

  describe('items', () => {
    it('renders an icon and applies text/icon colors', async () => {
      const el = await mount({
        items: [
          {
            title: 'Lights',
            icon: 'mdi:lightbulb',
            text_color: 'red',
            icon_color: 'amber',
            tap_action: TAP,
          },
        ],
      });
      const label = root(el).querySelector('.dashboard-sidebar-item-label') as HTMLElement;
      const icon = root(el).querySelector('.dashboard-sidebar-item-icon') as HTMLElement;
      expect(icon).to.exist;
      expect(icon.getAttribute('icon')).to.equal('mdi:lightbulb');
      expect(label.style.color).to.equal('red');
    });

    it('falls back to initials for an icon-less collapsed item', async () => {
      const el = await mount({
        start_collapsed: true,
        items: [{ title: 'Living Room', tap_action: TAP }],
      });
      const initials = root(el).querySelector('.dashboard-sidebar-initials');
      expect(initials?.textContent?.trim()).to.equal('LR');
    });
  });

  describe('categories', () => {
    const withCategory = (extra: Partial<DashboardSidebarConfig> = {}): DashboardSidebarConfig => ({
      items: [
        {
          title: 'Rooms',
          icon: 'mdi:floor-plan',
          start_collapsed: false,
          items: [{ title: 'Kitchen', tap_action: TAP }],
        },
      ],
      ...extra,
    });

    it('shows items when the category starts expanded', async () => {
      const el = await mount(withCategory());
      expect(root(el).querySelector('.dashboard-sidebar-category-items')).to.exist;
      expect(root(el).querySelectorAll('.dashboard-sidebar-item').length).to.be.greaterThan(0);
    });

    it('hides items when the category starts collapsed (the default)', async () => {
      const el = await mount({
        items: [{ title: 'Rooms', items: [{ title: 'Kitchen', tap_action: TAP }] }],
      });
      expect(root(el).querySelector('.dashboard-sidebar-category-items')).to.not.exist;
    });

    it('drops the guide line when guide_line is false', async () => {
      const el = await mount({
        items: [
          {
            title: 'Rooms',
            start_collapsed: false,
            guide_line: false,
            items: [{ title: 'Kitchen', tap_action: TAP }],
          },
        ],
      });
      expect(
        root(el).querySelector('.dashboard-sidebar-category-items')?.classList.contains('no-line'),
      ).to.equal(true);
    });

    it('opens a popover for a collapsed category', async () => {
      const el = await mount({
        start_collapsed: true,
        items: [
          {
            title: 'Rooms',
            icon: 'mdi:floor-plan',
            items: [{ title: 'Kitchen', tap_action: TAP }],
          },
        ],
      });
      const button = root(el).querySelector(
        '.dashboard-sidebar-category .dashboard-sidebar-item',
      ) as HTMLButtonElement;
      button.click();
      await el.updateComplete;
      const popover = root(el).querySelector('.dashboard-sidebar-popover');
      expect(popover).to.exist;
      expect(popover?.textContent).to.contain('Kitchen');
    });
  });

  describe('divider', () => {
    it('renders a divider entry', async () => {
      const el = await mount({ items: [{ title: 'A', tap_action: TAP }, { type: 'divider' }] });
      expect(root(el).querySelector('.dashboard-sidebar-divider')).to.exist;
    });
  });

  describe('footer', () => {
    const buttons = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ icon: `mdi:number-${i}`, tap_action: TAP }));

    it('renders every button inline when they fit', async () => {
      const el = await mount({
        items: [{ title: 'A', tap_action: TAP }],
        footer_buttons: buttons(3),
      });
      expect(root(el).querySelectorAll('.dashboard-sidebar-footer-btn').length).to.equal(3);
      expect(root(el).querySelector('.dashboard-sidebar-footer-more')).to.not.exist;
    });

    it('moves overflow behind a dots menu when too many to fit', async () => {
      const el = await mount({
        items: [{ title: 'A', tap_action: TAP }],
        footer_buttons: buttons(7),
      });
      const more = root(el).querySelector('.dashboard-sidebar-footer-more') as HTMLButtonElement;
      expect(more).to.exist;
      more.click();
      await el.updateComplete;
      const popover = root(el).querySelector('.dashboard-sidebar-footer-popover');
      expect(popover).to.exist;
      expect(popover?.querySelectorAll('.dashboard-sidebar-footer-btn').length).to.be.greaterThan(
        0,
      );
    });

    it('drops the divider bar when footer_divider is false', async () => {
      const el = await mount({
        items: [{ title: 'A', tap_action: TAP }],
        footer_divider: false,
        footer_buttons: buttons(2),
      });
      expect(
        root(el).querySelector('.dashboard-sidebar-footer')?.classList.contains('no-divider'),
      ).to.equal(true);
    });

    it('collapses the footer into a dots menu', async () => {
      const el = await mount({
        start_collapsed: true,
        items: [{ title: 'A', tap_action: TAP }],
        footer_buttons: buttons(3),
      });
      expect(root(el).querySelector('.dashboard-sidebar-footer-more')).to.exist;
    });
  });

  describe('content', () => {
    it('renders markdown content with alignment and background', async () => {
      const created: unknown[] = [];
      (window as unknown as { loadCardHelpers?: () => Promise<unknown> }).loadCardHelpers =
        async () => ({
          createCardElement: (cfg: unknown) => {
            created.push(cfg);
            const div = document.createElement('div');
            div.className = 'stub-card';
            return div;
          },
        });
      try {
        const el = await mount({
          content: '**hello**',
          content_align: 'center',
          content_background: 'rgba(0,0,0,0.1)',
          items: [{ title: 'A', tap_action: TAP }],
        });
        await aTimeout(0);
        await el.updateComplete;
        const content = root(el).querySelector('.dashboard-sidebar-content') as HTMLElement;
        expect(content).to.exist;
        expect(content.querySelector('.stub-card')).to.exist;
        expect(content.style.textAlign).to.equal('center');
        expect(created[0]).to.deep.equal({ type: 'markdown', content: '**hello**' });
      } finally {
        delete (window as unknown as { loadCardHelpers?: unknown }).loadCardHelpers;
      }
    });
  });

  describe('backgrounds and collapse', () => {
    it('applies a custom sidebar background', async () => {
      const el = await mount({
        background: 'rgb(10, 20, 30)',
        items: [{ title: 'A', tap_action: TAP }],
      });
      expect((root(el).querySelector('.sidebar') as HTMLElement).style.background).to.contain(
        'rgb(10, 20, 30)',
      );
    });

    it('starts collapsed and expands on toggle', async () => {
      const el = await mount({ start_collapsed: true, items: [{ title: 'A', tap_action: TAP }] });
      const sidebar = root(el).querySelector('.sidebar') as HTMLElement;
      expect(sidebar.classList.contains('collapsed')).to.equal(true);
      (root(el).querySelector('.dashboard-sidebar-toggle') as HTMLButtonElement).click();
      await el.updateComplete;
      expect(sidebar.classList.contains('collapsed')).to.equal(false);
    });
  });

  describe('errors', () => {
    const cases: Array<[string, unknown, string]> = [
      ['non-list items', { items: 'nope' }, 'items: must be a list'],
      [
        'bad position',
        { position: 'up', items: [{ title: 'A', tap_action: TAP }] },
        'position: must be "left" or "right"',
      ],
      ['item missing title', { items: [{ tap_action: TAP }] }, 'items[0]: needs a title'],
      [
        'nested category',
        { items: [{ title: 'C', items: [{ title: 'S', items: [] }] }] },
        'a category can only contain items',
      ],
      [
        'time token in date_format',
        { date_format: '%H', items: [{ title: 'A', tap_action: TAP }] },
        'date_format: only allows date tokens',
      ],
    ];

    cases.forEach(([name, config, message]) => {
      it(`shows the error panel: ${name}`, async () => {
        const el = await mount(config as DashboardSidebarConfig);
        const panel = root(el).querySelector('.config-error');
        expect(panel, name).to.exist;
        expect(panel?.textContent).to.contain(message);
      });
    });
  });
});
