import { describe, expect, it } from 'vitest';

import type { DashboardSidebarConfig } from './types';
import { validateConfig } from './validate';

/**
 * A minimal valid config the individual cases mutate into invalid shapes.
 */
const valid = (): DashboardSidebarConfig => ({
  items: [{ title: 'Home', icon: 'mdi:home', tap_action: { action: 'toggle' } }],
});

describe('validateConfig', () => {
  it('accepts a minimal valid config', () => {
    expect(validateConfig(valid())).toHaveLength(0);
  });

  it('rejects a non-mapping config', () => {
    expect(validateConfig(null as unknown as DashboardSidebarConfig)).toEqual([
      'dashboard_sidebar: config must be a mapping',
    ]);
  });

  it('flags unknown top-level and item keys', () => {
    expect(validateConfig({ ...valid(), bogus: 1 } as DashboardSidebarConfig)).toContain(
      'dashboard_sidebar: unknown option "bogus"',
    );
    const badItem = {
      items: [{ title: 'A', tap_action: { action: 'toggle' }, foo: 1 }],
    } as unknown as DashboardSidebarConfig;
    expect(validateConfig(badItem)).toContain('items[0]: unknown option "foo"');
  });

  it('checks enums and numeric types', () => {
    expect(
      validateConfig({ ...valid(), position: 'up' } as unknown as DashboardSidebarConfig),
    ).toContain('position: must be "left" or "right"');
    expect(
      validateConfig({ ...valid(), width: '240' } as unknown as DashboardSidebarConfig),
    ).toContain('width: must be a number');
    expect(
      validateConfig({ ...valid(), header_align: 'middle' } as unknown as DashboardSidebarConfig),
    ).toContain('header_align: must be left, center, or right');
    expect(
      validateConfig({
        ...valid(),
        collapsed_clock_format: '48h',
      } as unknown as DashboardSidebarConfig),
    ).toContain('collapsed_clock_format: must be "12h" or "24h"');
  });

  it('enforces the token domain per format field', () => {
    expect(validateConfig({ ...valid(), clock_format: '%Y' })).toContain(
      'clock_format: only allows time tokens, not %Y',
    );
    expect(validateConfig({ ...valid(), date_format: '%H' })).toContain(
      'date_format: only allows date tokens, not %H',
    );
    expect(validateConfig({ ...valid(), clock_format: '%H:%M:%S' })).toHaveLength(0);
    expect(validateConfig({ ...valid(), date_format: '%A, %B %-d' })).toHaveLength(0);
  });

  it('validates items, categories, and nesting depth', () => {
    expect(validateConfig({ items: 'nope' } as unknown as DashboardSidebarConfig)).toContain(
      'items: must be a list',
    );
    expect(
      validateConfig({ items: [{ tap_action: { action: 'toggle' } }] } as DashboardSidebarConfig),
    ).toContain('items[0]: needs a title');
    expect(validateConfig({ items: [{ title: 'A' }] } as DashboardSidebarConfig)).toContain(
      'items[0]: needs a tap_action',
    );
    expect(
      validateConfig({ items: [{ title: 'C', items: [] }] } as DashboardSidebarConfig),
    ).toContain('items[0]: category needs a non-empty items list');
    const nested = {
      items: [{ title: 'C', items: [{ title: 'Sub', items: [{ title: 'x', tap_action: {} }] }] }],
    } as unknown as DashboardSidebarConfig;
    expect(validateConfig(nested)).toContain(
      'items[0].items[0]: a category can only contain items',
    );
  });

  it('validates footer buttons', () => {
    expect(
      validateConfig({ ...valid(), footer_buttons: {} } as unknown as DashboardSidebarConfig),
    ).toContain('footer_buttons: must be a list');
    expect(
      validateConfig({
        ...valid(),
        footer_buttons: [{ tap_action: { action: 'toggle' } }],
      } as DashboardSidebarConfig),
    ).toContain('footer_buttons[0]: needs an icon');
  });
});
