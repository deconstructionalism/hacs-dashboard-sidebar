import { describe, expect, it } from 'vitest';

import type { DashboardSidebarConfig, SidebarConfig } from './types';
import { validateConfig } from './validate';

/** A minimal valid single-sidebar config. */
const side = (): SidebarConfig => ({
  body: [{ type: 'item', title: 'Home', tap_action: { action: 'toggle' } }],
});

describe('validateConfig — dual-sidebar container', () => {
  it('accepts a left-only container', () => {
    expect(validateConfig({ left: side() })).toHaveLength(0);
  });

  it('accepts both a left and a right sidebar', () => {
    expect(validateConfig({ left: side(), right: side() })).toHaveLength(0);
  });

  it('rejects a non-mapping container', () => {
    expect(validateConfig(null as unknown as DashboardSidebarConfig)).toEqual([
      'dashboard_sidebar: config must be a mapping',
    ]);
  });

  it('requires at least one side', () => {
    expect(validateConfig({})).toContain('dashboard_sidebar: needs a left or right sidebar');
  });

  it('rejects unknown top-level keys (only left/right)', () => {
    expect(
      validateConfig({ left: side(), middle: side() } as unknown as DashboardSidebarConfig),
    ).toContain('dashboard_sidebar: unknown option "middle"');
  });

  it('prefixes per-side errors with the side', () => {
    const errors = validateConfig({
      right: { body: [{ type: 'item', title: 'A' }] },
    } as unknown as DashboardSidebarConfig);
    expect(errors).toContain('right.body[0]: needs a tap_action');
  });
});
