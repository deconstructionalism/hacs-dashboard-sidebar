import { aTimeout, expect, fixture, html } from '@open-wc/testing';

import type { DashboardSidebar } from './dashboard-sidebar';
import type { DashboardSidebarConfig } from './lib/types';
import './dashboard-sidebar';

/** Card configs handed to the stubbed card helpers, reset per test. */
let createdCards: unknown[] = [];

/**
 * Mounts a fresh element, applies the config, and waits for the first render
 * and any async card builds.
 */
async function mount(config: DashboardSidebarConfig): Promise<DashboardSidebar> {
  const el = await fixture<DashboardSidebar>(html`<dashboard-sidebar></dashboard-sidebar>`);
  el.setConfig(config);
  await el.updateComplete;
  await aTimeout(0);
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

/** A tap action reused across item and footer fixtures. */
const TAP = { action: 'toggle' } as const;

describe('<dashboard-sidebar> config species', () => {
  beforeEach(() => {
    window.localStorage.clear();
    createdCards = [];
    (window as unknown as { loadCardHelpers?: () => Promise<unknown> }).loadCardHelpers =
      async () => ({
        createCardElement: (cfg: unknown) => {
          createdCards.push(cfg);
          const div = document.createElement('div');
          div.className = 'stub-card';
          return div;
        },
      });
  });

  afterEach(() => {
    delete (window as unknown as { loadCardHelpers?: unknown }).loadCardHelpers;
  });

  describe('header region', () => {
    it('renders title, clock, and date and honors per-block align', async () => {
      const el = await mount({
        header: [
          { type: 'title', text: 'Home', align: 'right' },
          { type: 'clock' },
          { type: 'date' },
        ],
        body: [{ type: 'item', title: 'A', tap_action: TAP }],
      });
      expect(root(el).querySelector('.dashboard-sidebar-header')).to.exist;
      const title = root(el).querySelector('.dashboard-sidebar-title') as HTMLElement;
      expect(title.textContent).to.contain('Home');
      expect(title.style.textAlign).to.equal('right');
      expect(root(el).querySelector('.dashboard-sidebar-clock')).to.exist;
      expect(root(el).querySelector('.dashboard-sidebar-date')).to.exist;
    });

    it('applies a strftime clock format', async () => {
      const el = await mount({ header: [{ type: 'clock', format: '%H:%M' }] });
      const text = root(el).querySelector('.dashboard-sidebar-clock')?.textContent?.trim() ?? '';
      expect(text).to.match(/^\d{2}:\d{2}$/);
    });

    it('omits the header region when it has no blocks', async () => {
      const el = await mount({ body: [{ type: 'item', title: 'A', tap_action: TAP }] });
      expect(root(el).querySelector('.dashboard-sidebar-header')).to.not.exist;
    });
  });

  describe('position', () => {
    it('defaults to the left', async () => {
      const el = await mount({ body: [{ type: 'item', title: 'A', tap_action: TAP }] });
      expect(root(el).querySelector('.sidebar')?.classList.contains('pos-left')).to.equal(true);
    });

    it('docks right when configured', async () => {
      const el = await mount({
        position: 'right',
        body: [{ type: 'item', title: 'A', tap_action: TAP }],
      });
      expect(root(el).querySelector('.sidebar')?.classList.contains('pos-right')).to.equal(true);
    });
  });

  describe('items', () => {
    it('renders an icon and applies text/icon colors', async () => {
      const el = await mount({
        body: [
          {
            type: 'item',
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
      expect(icon.getAttribute('icon')).to.equal('mdi:lightbulb');
      expect(label.style.color).to.equal('red');
    });

    it('falls back to initials for an icon-less collapsed item', async () => {
      const el = await mount({
        start_collapsed: true,
        body: [{ type: 'item', title: 'Living Room', tap_action: TAP }],
      });
      expect(root(el).querySelector('.dashboard-sidebar-initials')?.textContent?.trim()).to.equal(
        'LR',
      );
    });
  });

  describe('categories', () => {
    it('shows items when the category starts expanded', async () => {
      const el = await mount({
        body: [
          {
            type: 'category',
            title: 'Rooms',
            start_collapsed: false,
            items: [{ title: 'Kitchen', tap_action: TAP }],
          },
        ],
      });
      expect(root(el).querySelector('.dashboard-sidebar-category-items')).to.exist;
    });

    it('hides items when the category starts collapsed (the default)', async () => {
      const el = await mount({
        body: [
          { type: 'category', title: 'Rooms', items: [{ title: 'Kitchen', tap_action: TAP }] },
        ],
      });
      expect(root(el).querySelector('.dashboard-sidebar-category-items')).to.not.exist;
    });

    it('drops the guide line when guide_line is false', async () => {
      const el = await mount({
        body: [
          {
            type: 'category',
            title: 'Rooms',
            start_collapsed: false,
            guide_line: false,
            items: [{ title: 'K', tap_action: TAP }],
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
        body: [
          {
            type: 'category',
            title: 'Rooms',
            icon: 'mdi:floor-plan',
            items: [{ title: 'Kitchen', tap_action: TAP }],
          },
        ],
      });
      (
        root(el).querySelector(
          '.dashboard-sidebar-category .dashboard-sidebar-item',
        ) as HTMLButtonElement
      ).click();
      await el.updateComplete;
      const popover = root(el).querySelector('.dashboard-sidebar-popover');
      expect(popover).to.exist;
      expect(popover?.textContent).to.contain('Kitchen');
    });
  });

  describe('divider and regions', () => {
    it('renders a divider in either region', async () => {
      const el = await mount({
        header: [{ type: 'divider' }],
        body: [{ type: 'item', title: 'A', tap_action: TAP }],
      });
      expect(root(el).querySelector('.dashboard-sidebar-header .dashboard-sidebar-divider')).to
        .exist;
    });

    it('puts blocks in the fixed header and scrolling body', async () => {
      const el = await mount({
        header: [{ type: 'title', text: 'Home' }],
        body: [{ type: 'item', title: 'A', tap_action: TAP }],
      });
      expect(root(el).querySelector('.region-header')).to.exist;
      expect(root(el).querySelector('.region-body')).to.exist;
    });
  });

  describe('footer buttons', () => {
    const buttons = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ icon: `mdi:number-${i}`, tap_action: TAP }));

    it('renders every button inline when they fit', async () => {
      const el = await mount({
        body: [{ type: 'item', title: 'A', tap_action: TAP }],
        footer: { buttons: buttons(3) },
      });
      expect(root(el).querySelectorAll('.dashboard-sidebar-footer-btn').length).to.equal(3);
      expect(root(el).querySelector('.dashboard-sidebar-footer-more')).to.not.exist;
    });

    it('moves overflow behind a dots menu', async () => {
      const el = await mount({
        body: [{ type: 'item', title: 'A', tap_action: TAP }],
        footer: { buttons: buttons(7) },
      });
      const more = root(el).querySelector('.dashboard-sidebar-footer-more') as HTMLButtonElement;
      expect(more).to.exist;
      more.click();
      await el.updateComplete;
      expect(root(el).querySelector('.dashboard-sidebar-footer-popover')).to.exist;
    });

    it('drops the divider bar when footer.divider is false', async () => {
      const el = await mount({
        body: [{ type: 'item', title: 'A', tap_action: TAP }],
        footer: { divider: false, buttons: buttons(2) },
      });
      expect(
        root(el).querySelector('.dashboard-sidebar-footer')?.classList.contains('no-divider'),
      ).to.equal(true);
    });
  });

  describe('footer card', () => {
    it('renders a single card with no dots menu', async () => {
      const el = await mount({
        body: [{ type: 'item', title: 'A', tap_action: TAP }],
        footer: { card: '**foot**' },
      });
      const footer = root(el).querySelector('.dashboard-sidebar-footer');
      expect(footer?.querySelector('.stub-card')).to.exist;
      expect(root(el).querySelector('.dashboard-sidebar-footer-more')).to.not.exist;
    });

    it('is hidden when the sidebar is collapsed', async () => {
      const el = await mount({
        start_collapsed: true,
        body: [{ type: 'item', title: 'A', tap_action: TAP }],
        footer: { card: 'x' },
      });
      expect(root(el).querySelector('.dashboard-sidebar-footer')).to.not.exist;
    });
  });

  describe('card blocks', () => {
    it('renders a card block with alignment and background', async () => {
      const el = await mount({
        body: [{ type: 'card', card: '**hi**', align: 'center', background: 'rgba(0,0,0,0.1)' }],
      });
      const content = root(el).querySelector('.dashboard-sidebar-content') as HTMLElement;
      expect(content.querySelector('.stub-card')).to.exist;
      expect(content.style.textAlign).to.equal('center');
      expect(createdCards[0]).to.deep.equal({ type: 'markdown', content: '**hi**' });
    });

    it('hides card blocks when collapsed', async () => {
      const el = await mount({ start_collapsed: true, body: [{ type: 'card', card: 'x' }] });
      expect(root(el).querySelector('.dashboard-sidebar-content')).to.not.exist;
    });
  });

  describe('backgrounds and collapse', () => {
    it('applies a custom sidebar background', async () => {
      const el = await mount({
        background: 'rgb(10, 20, 30)',
        body: [{ type: 'item', title: 'A', tap_action: TAP }],
      });
      expect((root(el).querySelector('.sidebar') as HTMLElement).style.background).to.contain(
        'rgb(10, 20, 30)',
      );
    });

    it('starts collapsed and expands on toggle', async () => {
      const el = await mount({
        start_collapsed: true,
        body: [{ type: 'item', title: 'A', tap_action: TAP }],
      });
      const sidebar = root(el).querySelector('.sidebar') as HTMLElement;
      expect(sidebar.classList.contains('collapsed')).to.equal(true);
      (root(el).querySelector('.dashboard-sidebar-toggle') as HTMLButtonElement).click();
      await el.updateComplete;
      expect(sidebar.classList.contains('collapsed')).to.equal(false);
    });
  });

  describe('errors', () => {
    const cases: Array<[string, unknown, string]> = [
      ['no region', {}, 'needs a header or body'],
      ['bad block type', { body: [{ text: 'x' }] }, 'needs a valid type'],
      [
        'item missing title',
        { body: [{ type: 'item', tap_action: TAP }] },
        'body[0]: needs a title',
      ],
      [
        'nested category',
        {
          body: [
            { type: 'category', title: 'C', items: [{ type: 'category', title: 'S', items: [] }] },
          ],
        },
        'a category can only contain items',
      ],
      [
        'time token in date block',
        { header: [{ type: 'date', format: '%H' }] },
        'only allows date tokens',
      ],
      [
        'footer both modes',
        {
          body: [{ type: 'item', title: 'A', tap_action: TAP }],
          footer: { buttons: [], card: 'x' },
        },
        'either buttons or card',
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
