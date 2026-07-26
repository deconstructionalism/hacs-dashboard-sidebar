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
async function mount(
  config: Parameters<DashboardSidebar['setConfig']>[0],
): Promise<DashboardSidebar> {
  const el = await fixture<DashboardSidebar>(html`<dashboard-sidebar></dashboard-sidebar>`);
  el.setConfig(config);
  await el.updateComplete;
  return el;
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
});
