import { describe, expect, it } from 'vitest';

import type { SidebarConfig } from './types';
import { validateSidebar } from './validate';

/**
 * A minimal valid single-sidebar config the cases mutate into invalid shapes.
 */
const valid = (): SidebarConfig => ({
  body: [{ type: 'item', title: 'Home', tap_action: { action: 'toggle' } }],
});

describe('validateSidebar', () => {
  it('accepts a minimal valid config', () => {
    expect(validateSidebar(valid())).toHaveLength(0);
  });

  it('requires a header or body', () => {
    expect(validateSidebar({})).toContain(
      'dashboard_sidebar: needs a header or body with at least one block',
    );
  });

  it('flags unknown keys and non-list regions', () => {
    expect(validateSidebar({ ...valid(), bogus: 1 } as SidebarConfig)).toContain(
      'dashboard_sidebar: unknown option "bogus"',
    );
    expect(validateSidebar({ body: 'nope' } as unknown as SidebarConfig)).toContain(
      'body: must be a list',
    );
  });

  it('checks numeric types', () => {
    expect(validateSidebar({ ...valid(), width: '240' } as unknown as SidebarConfig)).toContain(
      'width: must be a number',
    );
  });

  it('requires a valid block type and flags unknown block keys', () => {
    expect(validateSidebar({ body: [{ text: 'x' }] } as unknown as SidebarConfig)).toContain(
      'body[0]: needs a valid type (title, clock, date, divider, item, category, card)',
    );
    expect(
      validateSidebar({
        header: [{ type: 'title', text: 'x', foo: 1 }],
      } as unknown as SidebarConfig),
    ).toContain('header[0]: unknown option "foo"');
  });

  it('validates title, clock, and date blocks', () => {
    expect(validateSidebar({ header: [{ type: 'title' }] } as unknown as SidebarConfig)).toContain(
      'header[0]: title needs text',
    );
    expect(
      validateSidebar({
        header: [{ type: 'title', text: 'x', align: 'middle' }],
      } as unknown as SidebarConfig),
    ).toContain('header[0].align: must be left, center, or right');
    expect(
      validateSidebar({ header: [{ type: 'clock', format: '%Y' }] } as SidebarConfig),
    ).toContain('header[0].format: only allows time tokens, not %Y');
    expect(
      validateSidebar({
        header: [{ type: 'clock', collapsed_format: '48h' }],
      } as unknown as SidebarConfig),
    ).toContain('header[0].collapsed_format: must be "12h" or "24h"');
    expect(
      validateSidebar({ header: [{ type: 'date', format: '%H' }] } as SidebarConfig),
    ).toContain('header[0].format: only allows date tokens, not %H');
  });

  it('validates items and category nesting', () => {
    expect(
      validateSidebar({
        body: [{ type: 'item', tap_action: { action: 'toggle' } }],
      } as SidebarConfig),
    ).toContain('body[0]: needs a title');
    expect(validateSidebar({ body: [{ type: 'item', title: 'A' }] } as SidebarConfig)).toContain(
      'body[0]: needs a tap_action',
    );
    expect(
      validateSidebar({ body: [{ type: 'category', title: 'C', items: [] }] } as SidebarConfig),
    ).toContain('body[0]: category needs a non-empty items list');
    const nested = {
      body: [
        { type: 'category', title: 'C', items: [{ type: 'category', title: 'S', items: [] }] },
      ],
    } as unknown as SidebarConfig;
    expect(validateSidebar(nested)).toContain(
      'body[0].items[0]: a category can only contain items',
    );
  });

  it('validates card blocks', () => {
    expect(validateSidebar({ body: [{ type: 'card' }] } as unknown as SidebarConfig)).toContain(
      'body[0]: card needs a card (markdown string or card config)',
    );
  });

  it('validates the footer', () => {
    expect(
      validateSidebar({
        ...valid(),
        footer: { buttons: [{ icon: 'mdi:cog', tap_action: { action: 'toggle' } }], card: 'x' },
      } as SidebarConfig),
    ).toContain('footer: set either buttons or card, not both');
    expect(
      validateSidebar({ ...valid(), footer: { buttons: {} } } as unknown as SidebarConfig),
    ).toContain('footer.buttons: must be a list');
    expect(
      validateSidebar({
        ...valid(),
        footer: { buttons: [{ tap_action: { action: 'toggle' } }] },
      } as SidebarConfig),
    ).toContain('footer.buttons[0]: needs an icon');
  });
});
