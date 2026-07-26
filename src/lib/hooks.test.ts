import { describe, expect, it } from 'vitest';

import type { SidebarConfig } from './types';
import { validateSidebar } from './validate';

/** A tap action reused across the fixtures. */
const TAP = { action: 'toggle' } as const;

describe('validateSidebar — class/id hooks', () => {
  it('accepts class and id on blocks and footer buttons', () => {
    const config: SidebarConfig = {
      header: [{ type: 'title', text: 'Home', class: 'my-title', id: 'title-1' }],
      body: [{ type: 'item', title: 'A', class: 'a b', id: 'home', tap_action: TAP }],
      footer: { buttons: [{ icon: 'mdi:cog', class: 'cog', id: 'cog', tap_action: TAP }] },
    };
    expect(validateSidebar(config)).toHaveLength(0);
  });

  it('rejects a non-string class or id', () => {
    expect(
      validateSidebar({
        body: [{ type: 'item', title: 'A', class: 5, tap_action: TAP }],
      } as unknown as SidebarConfig),
    ).toContain('body[0].class: must be a string');
    expect(
      validateSidebar({ header: [{ type: 'divider', id: 5 }] } as unknown as SidebarConfig),
    ).toContain('header[0].id: must be a string');
  });
});
