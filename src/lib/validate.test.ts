import { describe, expect, it } from 'vitest';

import type { DashboardSidebarConfig } from './types';
import { validateConfig } from './validate';

/**
 * A minimal valid single-sidebar config the cases mutate into invalid shapes.
 */
const valid = (): DashboardSidebarConfig => ({
  body: [{ type: 'item', title: 'Home', tap_action: { action: 'toggle' } }],
});

describe('validateConfig', () => {
  it('accepts a minimal valid config', () => {
    expect(validateConfig(valid())).toHaveLength(0);
  });

  it('requires a header or body', () => {
    expect(validateConfig({})).toContain(
      'dashboard_sidebar: needs a header or body with at least one block',
    );
  });

  it('rejects a non-mapping config', () => {
    expect(validateConfig(null as unknown as DashboardSidebarConfig)).toEqual([
      'dashboard_sidebar: config must be a mapping',
    ]);
  });

  it('checks the position enum', () => {
    expect(
      validateConfig({ ...valid(), position: 'up' } as unknown as DashboardSidebarConfig),
    ).toContain('position: must be "left" or "right"');
  });

  it('flags unknown keys and non-list regions', () => {
    expect(validateConfig({ ...valid(), bogus: 1 } as DashboardSidebarConfig)).toContain(
      'dashboard_sidebar: unknown option "bogus"',
    );
    expect(validateConfig({ body: 'nope' } as unknown as DashboardSidebarConfig)).toContain(
      'body: must be a list',
    );
  });

  it('checks numeric types', () => {
    expect(
      validateConfig({ ...valid(), width: '240' } as unknown as DashboardSidebarConfig),
    ).toContain('width: must be a number');
  });

  it('requires a valid block type and flags unknown block keys', () => {
    expect(
      validateConfig({ body: [{ text: 'x' }] } as unknown as DashboardSidebarConfig),
    ).toContain(
      'body[0]: needs a valid type (title, clock, date, divider, item, category, markdown, card)',
    );
    expect(
      validateConfig({
        header: [{ type: 'title', text: 'x', foo: 1 }],
      } as unknown as DashboardSidebarConfig),
    ).toContain('header[0]: unknown option "foo"');
  });

  it('accepts color options across block types and the footer', () => {
    expect(
      validateConfig({
        header: [
          { type: 'title', text: 'x', text_color: 'red' },
          { type: 'clock', text_color: '{{ states("sensor.c") }}' },
          { type: 'date', text_color: 'blue' },
          { type: 'divider', color: '#333' },
        ],
        body: [
          {
            type: 'category',
            title: 'c',
            text_color: 'green',
            icon_color: 'amber',
            items: [{ title: 'i', tap_action: { action: 'toggle' } }],
          },
          { type: 'markdown', content: 'x', text_color: 'teal' },
        ],
        footer: { markdown: 'x', markdown_color: 'coral' },
      } as unknown as DashboardSidebarConfig),
    ).toHaveLength(0);
  });

  it('accepts card_mod on the sidebar and on individual elements', () => {
    expect(
      validateConfig({
        card_mod: { style: ':host { color: red; }' },
        body: [
          {
            type: 'item',
            title: 'i',
            tap_action: { action: 'toggle' },
            card_mod: { style: '.x { color: blue; }' },
          },
        ],
        footer: {
          buttons: [
            { icon: 'mdi:cog', tap_action: { action: 'toggle' }, card_mod: { style: 'x' } },
          ],
        },
      } as unknown as DashboardSidebarConfig),
    ).toHaveLength(0);
  });

  it('rejects a non-mapping card_mod', () => {
    expect(
      validateConfig({ ...valid(), card_mod: 'nope' } as unknown as DashboardSidebarConfig),
    ).toContain('card_mod: must be a mapping');
    expect(
      validateConfig({
        body: [{ type: 'item', title: 'i', tap_action: { action: 'toggle' }, card_mod: ['x'] }],
      } as unknown as DashboardSidebarConfig),
    ).toContain('body[0].card_mod: must be a mapping');
  });

  it('validates title, clock, and date blocks', () => {
    expect(
      validateConfig({ header: [{ type: 'title' }] } as unknown as DashboardSidebarConfig),
    ).toContain('header[0]: title needs text');
    expect(
      validateConfig({
        header: [{ type: 'title', text: 'x', align: 'middle' }],
      } as unknown as DashboardSidebarConfig),
    ).toContain('header[0].align: must be left, center, or right');
    expect(
      validateConfig({
        header: [{ type: 'clock', collapsed_format: '48h' }],
      } as unknown as DashboardSidebarConfig),
    ).toContain('header[0].collapsed_format: must be "12h" or "24h"');
    // Cross-type tokens are allowed now (they render literally), not an error.
    expect(
      validateConfig({
        header: [{ type: 'clock', format: '%Y' }],
      } as DashboardSidebarConfig),
    ).toHaveLength(0);
  });

  it('validates items and category nesting', () => {
    expect(
      validateConfig({
        body: [{ type: 'item', tap_action: { action: 'toggle' } }],
      } as DashboardSidebarConfig),
    ).toContain('body[0]: needs a title');
    expect(
      validateConfig({ body: [{ type: 'item', title: 'A' }] } as DashboardSidebarConfig),
    ).toContain('body[0]: needs a tap_action');
    expect(
      validateConfig({
        body: [{ type: 'category', title: 'C', items: [] }],
      } as DashboardSidebarConfig),
    ).toContain('body[0]: category needs a non-empty items list');
    const nested = {
      body: [
        { type: 'category', title: 'C', items: [{ type: 'category', title: 'S', items: [] }] },
      ],
    } as unknown as DashboardSidebarConfig;
    expect(validateConfig(nested)).toContain('body[0].items[0]: a category can only contain items');
  });

  it('validates markdown and card blocks', () => {
    expect(
      validateConfig({ body: [{ type: 'card' }] } as unknown as DashboardSidebarConfig),
    ).toContain('body[0]: card needs a card config');
    expect(
      validateConfig({ body: [{ type: 'markdown' }] } as unknown as DashboardSidebarConfig),
    ).toContain('body[0]: markdown needs content');
  });

  it('validates the footer', () => {
    expect(
      validateConfig({
        ...valid(),
        footer: {
          buttons: [{ icon: 'mdi:cog', tap_action: { action: 'toggle' } }],
          markdown: 'x',
        },
      } as DashboardSidebarConfig),
    ).toContain('footer: set only one of buttons, card, or markdown');
    expect(
      validateConfig({ ...valid(), footer: { buttons: {} } } as unknown as DashboardSidebarConfig),
    ).toContain('footer.buttons: must be a list');
    expect(
      validateConfig({
        ...valid(),
        footer: { buttons: [{ tap_action: { action: 'toggle' } }] },
      } as DashboardSidebarConfig),
    ).toContain('footer.buttons[0]: needs an icon');
  });
});

/** A tap action reused across the merged fixtures. */
const TAP = { action: 'toggle' } as const;

// --- merged from abbr.test.ts ---
describe('validateConfig — abbr', () => {
  it('accepts an abbr on an icon-less item', () => {
    expect(
      validateConfig({
        body: [{ type: 'item', title: 'Loft Room', abbr: 'Lo', tap_action: TAP }],
      }),
    ).toHaveLength(0);
  });

  it('rejects a non-string abbr', () => {
    expect(
      validateConfig({
        body: [{ type: 'item', title: 'A', abbr: 5, tap_action: TAP }],
      } as unknown as DashboardSidebarConfig),
    ).toContain('body[0].abbr: must be a string');
  });

  it('rejects abbr together with an icon on an item', () => {
    expect(
      validateConfig({
        body: [{ type: 'item', title: 'A', icon: 'mdi:home', abbr: 'A', tap_action: TAP }],
      }),
    ).toContain('body[0]: abbr is only allowed when icon is not set');
  });

  it('applies the same rules to categories', () => {
    expect(
      validateConfig({
        body: [
          { type: 'category', title: 'Utah', abbr: 'Ut', items: [{ title: 'x', tap_action: TAP }] },
        ],
      }),
    ).toHaveLength(0);
    expect(
      validateConfig({
        body: [
          {
            type: 'category',
            title: 'Utah',
            icon: 'mdi:map',
            abbr: 'Ut',
            items: [{ title: 'x', tap_action: TAP }],
          },
        ],
      }),
    ).toContain('body[0]: abbr is only allowed when icon is not set');
  });
});

// --- merged from config-species.test.ts ---
describe('validateConfig — every block and option together', () => {
  it('accepts a config exercising every block type and option', () => {
    const config: DashboardSidebarConfig = {
      width: 300,
      start_collapsed: false,
      hide_on_mobile: true,
      background: '#111',
      header: [
        {
          type: 'title',
          text: '{{ states("sun.sun") }}',
          align: 'left',
          tap_action: { action: 'navigate', navigation_path: '/' },
        },
        {
          type: 'clock',
          format: '%-I:%M:%S %p',
          timezone: 'America/New_York',
          align: 'left',
          tap_action: { action: 'more-info', entity: 'sun.sun' },
          hold_action: { action: 'navigate', navigation_path: '/config' },
          double_tap_action: { action: 'toggle' },
        },
        { type: 'date', format: '%Y-%m-%d', align: 'left', tap_action: { action: 'none' } },
        { type: 'divider' },
        { type: 'markdown', content: '**hi**', align: 'center' },
        {
          type: 'card',
          card: { type: 'entities', entities: ['light.a'] },
          align: 'center',
          background: 'rgba(0,0,0,0.1)',
        },
      ],
      body: [
        {
          type: 'item',
          title: 'Home',
          icon: 'mdi:home',
          tap_action: { action: 'navigate', navigation_path: '/' },
        },
        { type: 'divider' },
        {
          type: 'category',
          title: 'Rooms',
          icon: 'mdi:floor-plan',
          start_collapsed: true,
          guide_line: false,
          items: [{ title: 'Kitchen', entity: 'light.k', tap_action: { action: 'toggle' } }],
        },
        { type: 'card', card: { type: 'entities', entities: ['light.k'] } },
      ],
      footer: {
        divider: false,
        buttons: [
          {
            icon: 'mdi:cog',
            title: 'Settings',
            tap_action: { action: 'navigate', navigation_path: '/config' },
          },
        ],
      },
      card_mod: { style: '.x {}' },
    };
    expect(validateConfig(config)).toHaveLength(0);
  });

  it('accepts a footer card in place of buttons', () => {
    const config: DashboardSidebarConfig = {
      body: [{ type: 'item', title: 'A', tap_action: { action: 'toggle' } }],
      footer: { card: { type: 'gauge', entity: 'sensor.x' } },
    };
    expect(validateConfig(config)).toHaveLength(0);
  });
});

// --- merged from hooks.test.ts ---
describe('validateConfig — class/id hooks', () => {
  it('accepts class and id on blocks and footer buttons', () => {
    const config: DashboardSidebarConfig = {
      header: [{ type: 'title', text: 'Home', class: 'my-title', id: 'title-1' }],
      body: [{ type: 'item', title: 'A', class: 'a b', id: 'home', tap_action: TAP }],
      footer: { buttons: [{ icon: 'mdi:cog', class: 'cog', id: 'cog', tap_action: TAP }] },
    };
    expect(validateConfig(config)).toHaveLength(0);
  });

  it('rejects a non-string class or id', () => {
    expect(
      validateConfig({
        body: [{ type: 'item', title: 'A', class: 5, tap_action: TAP }],
      } as unknown as DashboardSidebarConfig),
    ).toContain('body[0].class: must be a string');
    expect(
      validateConfig({ header: [{ type: 'divider', id: 5 }] } as unknown as DashboardSidebarConfig),
    ).toContain('header[0].id: must be a string');
  });
});
