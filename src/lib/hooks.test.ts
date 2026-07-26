import { describe, expect, it } from 'vitest';

import type { DashboardSidebarConfig } from './types';
import { validateConfig } from './validate';

/** A tap action reused across the fixtures. */
const TAP = { action: 'toggle' } as const;

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
