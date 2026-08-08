import { expect, fixture, html } from '@open-wc/testing';

import type { DashboardSidebar } from './dashboard-sidebar';
import './dashboard-sidebar';

/** Stubs card-mod's element, recording every applyToElement invocation. */
class StubCardMod extends HTMLElement {
  /** The recorded calls, inspected by the tests. */
  static calls: Array<{ element: HTMLElement; type: string; config: unknown }> = [];

  /** Mimics card-mod's static apply surface by recording the arguments. */
  static applyToElement(element: HTMLElement, type: string, config: unknown): void {
    StubCardMod.calls.push({ element, type, config });
  }
}

/**
 * Mounts a fresh element with the given config and waits for its first render.
 */
const mount = async (
  config: Parameters<DashboardSidebar['setConfig']>[0],
): Promise<DashboardSidebar> => {
  const el = await fixture<DashboardSidebar>(html`<dashboard-sidebar></dashboard-sidebar>`);
  el.setConfig(config);
  await el.updateComplete;
  return el;
};

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
