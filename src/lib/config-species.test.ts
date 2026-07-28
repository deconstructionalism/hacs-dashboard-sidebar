import { describe, expect, it } from 'vitest';

import type { DashboardSidebarConfig } from './types';
import { validateConfig } from './validate';

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
