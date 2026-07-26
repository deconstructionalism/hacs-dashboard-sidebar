import { describe, expect, it } from 'vitest';

import type { SidebarConfig } from './types';
import { validateSidebar } from './validate';

/** A tap action reused across the fixtures. */
const TAP = { action: 'toggle' } as const;

describe('validateSidebar — abbr', () => {
  it('accepts an abbr on an icon-less item', () => {
    expect(
      validateSidebar({
        body: [{ type: 'item', title: 'Loft Room', abbr: 'Lo', tap_action: TAP }],
      }),
    ).toHaveLength(0);
  });

  it('rejects a non-string abbr', () => {
    expect(
      validateSidebar({
        body: [{ type: 'item', title: 'A', abbr: 5, tap_action: TAP }],
      } as unknown as SidebarConfig),
    ).toContain('body[0].abbr: must be a string');
  });

  it('rejects abbr together with an icon on an item', () => {
    expect(
      validateSidebar({
        body: [{ type: 'item', title: 'A', icon: 'mdi:home', abbr: 'A', tap_action: TAP }],
      }),
    ).toContain('body[0]: abbr is only allowed when icon is not set');
  });

  it('applies the same rules to categories', () => {
    expect(
      validateSidebar({
        body: [
          { type: 'category', title: 'Utah', abbr: 'Ut', items: [{ title: 'x', tap_action: TAP }] },
        ],
      }),
    ).toHaveLength(0);
    expect(
      validateSidebar({
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
