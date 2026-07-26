import { describe, expect, it } from 'vitest';

import type { DashboardSidebarConfig } from './types';
import { validateConfig } from './validate';

describe('validateConfig — every option together', () => {
  it('accepts a config that exercises every top-level and nested option', () => {
    const config: DashboardSidebarConfig = {
      position: 'right',
      width: 300,
      start_collapsed: false,
      hide_on_mobile: true,
      background: '#111',
      clock: true,
      clock_format: '%-I:%M:%S %p',
      collapsed_clock_format: '12h',
      date: true,
      date_format: '%A, %B %-d',
      title: '{{ states("sun.sun") }}',
      header_align: 'left',
      content: '**hi**',
      content_align: 'center',
      content_background: 'rgba(0,0,0,0.1)',
      items: [
        {
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
      ],
      footer_buttons: [
        {
          icon: 'mdi:cog',
          title: 'Settings',
          tap_action: { action: 'navigate', navigation_path: '/config' },
        },
      ],
      footer_divider: false,
      card_mod: { style: '.x {}' },
    };
    expect(validateConfig(config)).toHaveLength(0);
  });
});
