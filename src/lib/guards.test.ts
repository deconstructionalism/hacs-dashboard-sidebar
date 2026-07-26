import { describe, expect, it } from 'vitest';

import { isCategory, isDivider } from './guards';
import type { SidebarEntry } from './types';

describe('isDivider', () => {
  it('matches only the divider entry', () => {
    expect(isDivider({ type: 'divider' } as SidebarEntry)).toBe(true);
    expect(isDivider({ type: 'item', title: 'A', tap_action: { action: 'toggle' } })).toBe(false);
  });
});

describe('isCategory', () => {
  it('matches an explicitly typed category', () => {
    expect(
      isCategory({
        type: 'category',
        title: 'Rooms',
        items: [{ title: 'A', tap_action: { action: 'toggle' } }],
      }),
    ).toBe(true);
  });

  it('matches a terse category that only carries an items list', () => {
    expect(
      isCategory({ title: 'Rooms', items: [{ title: 'A', tap_action: { action: 'toggle' } }] }),
    ).toBe(true);
  });

  it('rejects items and dividers', () => {
    expect(isCategory({ type: 'item', title: 'A', tap_action: { action: 'toggle' } })).toBe(false);
    expect(isCategory({ type: 'divider' } as SidebarEntry)).toBe(false);
    expect(isCategory({ title: 'A', tap_action: { action: 'toggle' } } as SidebarEntry)).toBe(
      false,
    );
  });
});
