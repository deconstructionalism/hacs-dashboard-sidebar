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
const mount = async (config: DashboardSidebarConfig): Promise<DashboardSidebar> => {
  const el = await fixture<DashboardSidebar>(html`<dashboard-sidebar></dashboard-sidebar>`);
  el.setConfig(config);
  await el.updateComplete;
  await aTimeout(0);
  await el.updateComplete;
  return el;
};

/**
 * Returns the element's shadow root, asserting it exists.
 */
const root = (el: DashboardSidebar): ShadowRoot => {
  expect(el.shadowRoot).to.exist;
  return el.shadowRoot as ShadowRoot;
};

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

    it('applies text color to title, clock, and date', async () => {
      const el = await mount({
        header: [
          { type: 'title', text: 'Home', text_color: 'red' },
          { type: 'clock', text_color: 'green' },
          { type: 'date', text_color: 'blue' },
        ],
        body: [{ type: 'item', title: 'A', tap_action: TAP }],
      });
      expect(
        (root(el).querySelector('.dashboard-sidebar-title') as HTMLElement).style.color,
      ).to.equal('red');
      expect(
        (root(el).querySelector('.dashboard-sidebar-clock') as HTMLElement).style.color,
      ).to.equal('green');
      expect(
        (root(el).querySelector('.dashboard-sidebar-date') as HTMLElement).style.color,
      ).to.equal('blue');
    });
  });

  describe('side', () => {
    it('defaults to the left', async () => {
      const el = await mount({ body: [{ type: 'item', title: 'A', tap_action: TAP }] });
      expect(root(el).querySelector('.sidebar')?.classList.contains('pos-left')).to.equal(true);
    });

    it('docks right when position is right', async () => {
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

  describe('navigate highlight', () => {
    it('marks an element whose navigate action targets the current page', async () => {
      const original = window.location.pathname;
      window.history.pushState({}, '', '/lovelace/nav-home');
      try {
        const el = await mount({
          body: [
            {
              type: 'item',
              title: 'Home',
              tap_action: { action: 'navigate', navigation_path: '/lovelace/nav-home' },
            },
            {
              type: 'item',
              title: 'Away',
              tap_action: { action: 'navigate', navigation_path: '/lovelace/other' },
            },
          ],
        });
        const items = root(el).querySelectorAll('.dashboard-sidebar-item');
        expect(items[0].classList.contains('nav-active')).to.equal(true);
        expect(items[1].classList.contains('nav-active')).to.equal(false);
      } finally {
        window.history.pushState({}, '', original);
      }
    });

    it('honors active_highlight: false to opt out', async () => {
      const original = window.location.pathname;
      window.history.pushState({}, '', '/lovelace/nav-home');
      try {
        const el = await mount({
          body: [
            {
              type: 'item',
              title: 'Home',
              active_highlight: false,
              tap_action: { action: 'navigate', navigation_path: '/lovelace/nav-home' },
            },
          ],
        });
        expect(
          root(el).querySelector('.dashboard-sidebar-item')?.classList.contains('nav-active'),
        ).to.equal(false);
      } finally {
        window.history.pushState({}, '', original);
      }
    });

    it('updates the highlight on navigation', async () => {
      const original = window.location.pathname;
      window.history.pushState({}, '', '/lovelace/one');
      try {
        const el = await mount({
          body: [
            {
              type: 'item',
              title: 'Two',
              tap_action: { action: 'navigate', navigation_path: '/lovelace/two' },
            },
          ],
        });
        const item = root(el).querySelector('.dashboard-sidebar-item') as HTMLElement;
        expect(item.classList.contains('nav-active')).to.equal(false);
        window.history.pushState({}, '', '/lovelace/two');
        window.dispatchEvent(new Event('location-changed'));
        await el.updateComplete;
        expect(item.classList.contains('nav-active')).to.equal(true);
      } finally {
        window.history.pushState({}, '', original);
      }
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

    it('applies icon and text colors to an expanded category header', async () => {
      const el = await mount({
        body: [
          {
            type: 'category',
            title: 'Rooms',
            icon: 'mdi:floor-plan',
            text_color: 'coral',
            icon_color: 'navy',
            start_collapsed: false,
            items: [{ title: 'Kitchen', tap_action: TAP }],
          },
        ],
      });
      const header = root(el).querySelector('.dashboard-sidebar-category-header') as HTMLElement;
      const label = header.querySelector('.label') as HTMLElement;
      const icon = header.querySelector('ha-icon') as HTMLElement;
      expect(label.style.color).to.equal('coral');
      expect(icon.style.color).to.equal('navy');
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

    it('applies a color to the divider line', async () => {
      const el = await mount({
        header: [{ type: 'divider', color: 'purple' }],
        body: [{ type: 'item', title: 'A', tap_action: TAP }],
      });
      const divider = root(el).querySelector('.dashboard-sidebar-divider') as HTMLElement;
      expect(divider.style.background).to.equal('purple');
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

  describe('footer content', () => {
    it('renders a footer markdown block with no dots menu', async () => {
      const el = await mount({
        body: [{ type: 'item', title: 'A', tap_action: TAP }],
        footer: { markdown: '**foot**' },
      });
      const footer = root(el).querySelector('.dashboard-sidebar-footer');
      expect(footer?.querySelector('.stub-card')).to.exist;
      expect(root(el).querySelector('.dashboard-sidebar-footer-more')).to.not.exist;
      expect(createdCards[0]).to.deep.equal({ type: 'markdown', content: '**foot**' });
    });

    it('renders a footer manual card at full width', async () => {
      const el = await mount({
        body: [{ type: 'item', title: 'A', tap_action: TAP }],
        footer: { card: { type: 'entities', entities: ['light.a'] } },
      });
      const content = root(el).querySelector(
        '.dashboard-sidebar-footer .dashboard-sidebar-content',
      ) as HTMLElement;
      expect(content.querySelector('.stub-card')).to.exist;
      expect(content.classList.contains('card-fill')).to.equal(true);
      expect(createdCards[0]).to.deep.equal({ type: 'entities', entities: ['light.a'] });
    });

    it('is hidden when the sidebar is collapsed', async () => {
      const el = await mount({
        start_collapsed: true,
        body: [{ type: 'item', title: 'A', tap_action: TAP }],
        footer: { markdown: 'x' },
      });
      expect(root(el).querySelector('.dashboard-sidebar-footer')).to.not.exist;
    });

    it('applies a text color to the markdown footer via --primary-text-color', async () => {
      const el = await mount({
        body: [{ type: 'item', title: 'A', tap_action: TAP }],
        footer: { markdown: 'x', markdown_color: 'teal' },
      });
      const content = root(el).querySelector(
        '.dashboard-sidebar-footer .dashboard-sidebar-content',
      ) as HTMLElement;
      expect(content.style.color).to.equal('teal');
      expect(content.style.getPropertyValue('--primary-text-color')).to.equal('teal');
    });

    it('makes the markdown footer clickable when it has a tap action', async () => {
      const el = await mount({
        body: [{ type: 'item', title: 'A', tap_action: TAP }],
        footer: { markdown: 'x', tap_action: TAP },
      });
      const content = root(el).querySelector(
        '.dashboard-sidebar-footer .dashboard-sidebar-content',
      ) as HTMLElement;
      expect(content.classList.contains('clickable')).to.equal(true);
    });

    it('drops the footer divider bar for a card/markdown footer', async () => {
      const el = await mount({
        body: [{ type: 'item', title: 'A', tap_action: TAP }],
        footer: { markdown: 'x', divider: false },
      });
      expect(
        root(el).querySelector('.dashboard-sidebar-footer')?.classList.contains('no-divider'),
      ).to.equal(true);
    });
  });

  describe('markdown blocks', () => {
    it('renders a markdown block with alignment', async () => {
      const el = await mount({
        body: [{ type: 'markdown', content: '**hi**', align: 'center' }],
      });
      const content = root(el).querySelector('.dashboard-sidebar-markdown') as HTMLElement;
      expect(content.querySelector('.stub-card')).to.exist;
      expect(content.style.textAlign).to.equal('center');
      expect(createdCards[0]).to.deep.equal({ type: 'markdown', content: '**hi**' });
    });

    it('applies a text color via --primary-text-color', async () => {
      const el = await mount({
        body: [{ type: 'markdown', content: 'x', text_color: 'tomato' }],
      });
      const content = root(el).querySelector('.dashboard-sidebar-markdown') as HTMLElement;
      expect(content.style.color).to.equal('tomato');
      expect(content.style.getPropertyValue('--primary-text-color')).to.equal('tomato');
    });

    it('hides markdown blocks when collapsed', async () => {
      const el = await mount({ start_collapsed: true, body: [{ type: 'markdown', content: 'x' }] });
      expect(root(el).querySelector('.dashboard-sidebar-markdown')).to.not.exist;
    });
  });

  describe('card blocks', () => {
    it('stretches an object card to full width, with a background', async () => {
      const el = await mount({
        body: [
          {
            type: 'card',
            card: { type: 'entities', entities: ['light.a'] },
            background: 'rgba(0,0,0,0.1)',
          },
        ],
      });
      const content = root(el).querySelector('.dashboard-sidebar-content') as HTMLElement;
      expect(content.querySelector('.stub-card')).to.exist;
      // Object cards fill the sidebar width instead of shrinking to content.
      expect(content.style.alignItems).to.equal('stretch');
      expect(content.classList.contains('card-fill')).to.equal(true);
      expect(content.style.background).to.contain('rgba(0, 0, 0, 0.1)');
      expect(createdCards[0]).to.deep.equal({ type: 'entities', entities: ['light.a'] });
    });

    it('hides card blocks when collapsed', async () => {
      const el = await mount({
        start_collapsed: true,
        body: [{ type: 'card', card: { type: 'entities', entities: [] } }],
      });
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

  describe('collapsed preview pinned popovers', () => {
    /** Mounts a collapsed preview with the given config and selection. */
    const pinned = async (
      config: DashboardSidebarConfig,
      selected: string,
    ): Promise<DashboardSidebar> => {
      const el = await fixture<DashboardSidebar>(html`<dashboard-sidebar></dashboard-sidebar>`);
      el.preview = true;
      el.previewCollapsed = true;
      el.setConfig(config);
      el.previewSelected = selected;
      // Two settle cycles: one to render the collapsed strip, a second after
      // updated() measures the anchor and pins the popover open.
      await el.updateComplete;
      await aTimeout(0);
      await el.updateComplete;
      return el;
    };

    it("keeps a category's popover open while its child is selected", async () => {
      const el = await pinned(
        {
          body: [
            {
              type: 'category',
              title: 'Rooms',
              items: [{ title: 'Kitchen', tap_action: TAP }],
            },
          ],
        },
        'body:0.0',
      );
      expect(root(el).querySelector('.dashboard-sidebar-popover')).to.exist;
      expect(root(el).querySelector('.dashboard-sidebar-popover .sb-selected')).to.exist;
    });

    it('keeps the footer overflow popover open while a button is selected', async () => {
      const el = await pinned(
        {
          body: [{ type: 'item', title: 'A', tap_action: TAP }],
          footer: { buttons: [{ icon: 'mdi:cog', tap_action: TAP }] },
        },
        'footer:btn:0',
      );
      expect(root(el).querySelector('.dashboard-sidebar-footer-popover')).to.exist;
    });

    it('does not pin a popover when the category itself is selected', async () => {
      const el = await pinned(
        {
          body: [
            {
              type: 'category',
              title: 'Rooms',
              items: [{ title: 'Kitchen', tap_action: TAP }],
            },
          ],
        },
        'body:0',
      );
      expect(root(el).querySelector('.dashboard-sidebar-popover')).to.not.exist;
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
        'footer both modes',
        {
          body: [{ type: 'item', title: 'A', tap_action: TAP }],
          footer: { buttons: [], markdown: 'x' },
        },
        'set only one of buttons, card, or markdown',
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

// --- merged from abbr-tooltip.browser.test.ts ---
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

  it('shows tooltips for buttons inside the open footer popover', async () => {
    const el = await mount({
      start_collapsed: true,
      body: [{ type: 'item', title: 'A', tap_action: TAP }],
      footer: { buttons: [{ icon: 'mdi:cog', title: 'Settings', tap_action: TAP }] },
    });
    const dots = root(el).querySelector('.dashboard-sidebar-footer-more') as HTMLElement;
    dots.click();
    await el.updateComplete;
    const popBtn = root(el).querySelector(
      '.dashboard-sidebar-footer-popover .dashboard-sidebar-footer-btn',
    ) as HTMLElement;
    popBtn.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(root(el).querySelector('.dashboard-sidebar-tooltip')?.textContent?.trim()).to.equal(
      'Settings',
    );
  });
});

// --- merged from card-mod.browser.test.ts ---
/** Stubs card-mod's element, recording every applyToElement invocation. */
class StubCardMod extends HTMLElement {
  /** The recorded calls, inspected by the tests. */
  static calls: Array<{ element: HTMLElement; type: string; config: unknown }> = [];

  /** Mimics card-mod's static apply surface by recording the arguments. */
  static applyToElement(element: HTMLElement, type: string, config: unknown): void {
    StubCardMod.calls.push({ element, type, config });
  }
}

describe('<dashboard-sidebar> card-mod delegation', () => {
  before(() => {
    if (!customElements.get('card-mod')) {
      customElements.define('card-mod', StubCardMod);
    }
  });

  beforeEach(() => {
    StubCardMod.calls = [];
    window.localStorage.clear();
  });

  it('forwards the card_mod config to card-mod applyToElement', async () => {
    const cardMod = { style: '.dashboard-sidebar-title { color: red; }' };
    const el = await mount({
      header: [{ type: 'title', text: 'Home' }],
      card_mod: cardMod,
      body: [{ type: 'item', title: 'A', tap_action: { action: 'toggle' } }],
    });

    expect(StubCardMod.calls.length).to.be.greaterThan(0);
    const call = StubCardMod.calls[0];
    expect(call.element).to.equal(el);
    expect(call.type).to.equal('dashboard-sidebar');
    expect(call.config).to.deep.equal(cardMod);
  });

  it('does not call card-mod when no card_mod config is present', async () => {
    await mount({ body: [{ type: 'item', title: 'A', tap_action: { action: 'toggle' } }] });
    expect(StubCardMod.calls.length).to.equal(0);
  });

  it('does not call card-mod for an invalid config', async () => {
    await mount({ card_mod: { style: 'x' }, body: 'nope' } as unknown as Parameters<
      DashboardSidebar['setConfig']
    >[0]);
    expect(StubCardMod.calls.length).to.equal(0);
  });

  it('applies card-mod only once across re-renders', async () => {
    const el = await mount({
      card_mod: { style: 'x' },
      body: [{ type: 'item', title: 'A', tap_action: { action: 'toggle' } }],
    });
    const rerender = el as unknown as { requestUpdate: () => void };
    rerender.requestUpdate();
    await el.updateComplete;
    rerender.requestUpdate();
    await el.updateComplete;
    expect(StubCardMod.calls.length).to.equal(1);
  });

  it('scopes a per-element card_mod to that element by data-loc', async () => {
    await mount({
      header: [
        {
          type: 'title',
          text: 'One',
          card_mod: { style: '.dashboard-sidebar-title { color: red; }' },
        },
        { type: 'title', text: 'Two' },
      ],
    });
    const call = StubCardMod.calls.find((c) => c.type.startsWith('dashboard-sidebar:'));
    expect(call, 'element-level card-mod call').to.exist;
    expect(call!.type).to.equal('dashboard-sidebar:header:0');
    expect((call!.element as HTMLElement).getAttribute('data-loc')).to.equal('header:0');
    const style = (call!.config as { style: string }).style;
    // Self (compound) branch matches the title, which carries the class itself.
    expect(style).to.contain('[data-loc="header:0"]:is(.dashboard-sidebar-title)');
    // Descendant branch for nested targets.
    expect(style).to.contain('[data-loc="header:0"] :is(.dashboard-sidebar-title)');
  });

  it('the scoped style really isolates one element from its siblings', async () => {
    // Prove the rewritten CSS colors only the matching data-loc element.
    const { scopeCss } = await import('./lib/card-mod');
    const scoped = scopeCss(
      '.dashboard-sidebar-title { color: rgb(255, 0, 0); }',
      '[data-loc="header:0"]',
    );
    expect(scoped, 'scopeCss output').to.be.a('string');
    const host = document.createElement('div');
    const sr = host.attachShadow({ mode: 'open' });
    sr.innerHTML = `<style>${scoped}</style>
      <div data-loc="header:0" class="dashboard-sidebar-title">One</div>
      <div data-loc="header:1" class="dashboard-sidebar-title">Two</div>`;
    document.body.appendChild(host);
    const one = sr.querySelector('[data-loc="header:0"]') as HTMLElement;
    const two = sr.querySelector('[data-loc="header:1"]') as HTMLElement;
    expect(getComputedStyle(one).color).to.equal('rgb(255, 0, 0)');
    expect(getComputedStyle(two).color).to.not.equal('rgb(255, 0, 0)');
    host.remove();
  });

  it('leaves a non-string (object-form) element style unwrapped', async () => {
    await mount({
      header: [
        {
          type: 'title',
          text: 'One',
          card_mod: { style: { '.dashboard-sidebar-title': 'color: red;' } },
        },
      ],
    });
    const call = StubCardMod.calls.find((c) => c.type.startsWith('dashboard-sidebar:'));
    expect(call, 'element-level card-mod call').to.exist;
    expect((call!.config as { style: unknown }).style).to.deep.equal({
      '.dashboard-sidebar-title': 'color: red;',
    });
  });
});

// --- merged from hooks.browser.test.ts ---
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
