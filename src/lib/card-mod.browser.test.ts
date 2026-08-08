import { expect } from '@open-wc/testing';

import { applyCardMod, scopeCss } from './card-mod';

/** A stand-in card-mod element recording applyToElement calls (or throwing). */
class StubCardMod extends HTMLElement {
  /** Recorded calls, inspected by the tests. */
  static calls: Array<{ element: HTMLElement; type: string; config: unknown }> = [];
  /** When true, applyToElement throws to exercise the failure path. */
  static shouldThrow = false;

  /** Records the arguments, or throws when shouldThrow is set. */
  static applyToElement(element: HTMLElement, type: string, config: unknown): void {
    if (StubCardMod.shouldThrow) {
      throw new Error('boom');
    }
    StubCardMod.calls.push({ element, type, config });
  }
}

describe('applyCardMod without card-mod installed', () => {
  it('returns false and does nothing', () => {
    // Runs before the card-mod stub is defined below.
    expect(applyCardMod(document.createElement('div'), { style: 'x' })).to.equal(false);
  });
});

describe('applyCardMod with card-mod installed', () => {
  before(() => {
    if (!customElements.get('card-mod')) {
      customElements.define('card-mod', StubCardMod);
    }
  });

  beforeEach(() => {
    StubCardMod.calls = [];
    StubCardMod.shouldThrow = false;
  });

  it('delegates to card-mod and reports success', () => {
    const host = document.createElement('div');
    const config = { style: '.x { color: red }' };
    expect(applyCardMod(host, config, 'my-type')).to.equal(true);
    expect(StubCardMod.calls).to.have.length(1);
    expect(StubCardMod.calls[0].element).to.equal(host);
    expect(StubCardMod.calls[0].type).to.equal('my-type');
    expect(StubCardMod.calls[0].config).to.equal(config);
  });

  it('defaults the type to dashboard-sidebar', () => {
    applyCardMod(document.createElement('div'), {});
    expect(StubCardMod.calls[0].type).to.equal('dashboard-sidebar');
  });

  it('swallows a card-mod failure and returns false', () => {
    StubCardMod.shouldThrow = true;
    expect(applyCardMod(document.createElement('div'), {})).to.equal(false);
  });
});

describe('scopeCss', () => {
  it('scopes each rule to the host element and its descendants', () => {
    const out = scopeCss('.a { color: red; }', '[data-loc="header:0"]');
    expect(out).to.contain('[data-loc="header:0"]:is(.a)');
    expect(out).to.contain('[data-loc="header:0"] :is(.a)');
  });

  it('recurses into grouping at-rules', () => {
    const out = scopeCss('@media (min-width: 1px) { .a { color: red; } }', '[data-loc="x"]') ?? '';
    expect(out).to.contain('@media');
    expect(out).to.contain('[data-loc="x"]:is(.a)');
  });

  it('scopes a :host selector too', () => {
    const out = scopeCss(':host { border: 1px; }', '[data-loc="x"]') ?? '';
    expect(out).to.contain('[data-loc="x"]:is(:host)');
  });
});
