import { describe, expect, it } from 'vitest';

import { starterConfig } from './bootstrap';
import { validateConfig } from './validate';

const hass = {
  states: {
    'light.a': { attributes: { friendly_name: 'Lamp A' } },
    'light.b': {},
    'switch.x': {},
  },
};

const lovelace = {
  config: {
    views: [
      { title: 'Home', path: 'home', icon: 'mdi:home' },
      { title: 'Devices', path: 'devices', icon: 'mdi:devices' },
      { title: 'Hidden', path: 'hidden', subview: true },
    ],
  },
};

describe('starterConfig', () => {
  it('builds a valid config', () => {
    expect(validateConfig(starterConfig(hass, lovelace))).toHaveLength(0);
  });

  it('seeds a centered clock, date, and greeting in the header', () => {
    const cfg = starterConfig(hass, lovelace);
    expect(cfg.header?.map((b) => b.type)).toEqual(['clock', 'date', 'title']);
    expect(cfg.header?.[0]).toMatchObject({ type: 'clock', align: 'center' });
    expect(cfg.header?.[2]).toMatchObject({ type: 'title', text: 'Hello {{ user }}' });
  });

  it('adds one navigate link per non-subview, using its icon', () => {
    const cfg = starterConfig(hass, lovelace);
    // The subview is excluded.
    expect(cfg.body).toHaveLength(2);
    expect(cfg.body?.[0]).toMatchObject({
      type: 'item',
      icon: 'mdi:home',
      tap_action: { action: 'navigate', navigation_path: '/lovelace/home' },
    });
  });

  it('adds the instance lights as footer toggle buttons', () => {
    const cfg = starterConfig(hass, lovelace);
    expect(cfg.footer?.buttons).toHaveLength(2);
    expect(cfg.footer?.buttons?.[0]).toMatchObject({
      entity: 'light.a',
      tap_action: { action: 'toggle', entity: 'light.a' },
    });
  });

  it('omits body and footer when there are no views or lights', () => {
    const cfg = starterConfig({ states: {} }, { config: { views: [] } });
    expect(cfg.body).toBeUndefined();
    expect(cfg.footer).toBeUndefined();
    expect(validateConfig(cfg)).toHaveLength(0);
  });
});
