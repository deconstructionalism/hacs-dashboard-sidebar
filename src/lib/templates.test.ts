import type { HomeAssistant } from 'custom-card-helpers';
import { describe, expect, it, vi } from 'vitest';

import type { DashboardSidebarConfig } from './types';
import { isTemplate, TemplateManager } from './templates';

/** A hass whose connection records every render_template subscription. */
const makeHass = () => {
  const subs: Array<{
    template: string;
    cb: (m: { result: string }) => void;
    unsub: ReturnType<typeof vi.fn>;
  }> = [];
  const hass = {
    connection: {
      subscribeMessage: (
        cb: (m: { result: string }) => void,
        params: { type: string; template: string },
      ) => {
        const unsub = vi.fn();
        subs.push({ template: params.template, cb, unsub });
        return Promise.resolve(unsub);
      },
    },
  } as unknown as HomeAssistant;
  /** Delivers a rendered result to every subscription for a template. */
  const emit = (template: string, result: string): void => {
    subs.filter((s) => s.template === template).forEach((s) => s.cb({ result }));
  };
  return { hass, subs, emit };
};

const TAP = { action: 'toggle' } as const;

describe('isTemplate', () => {
  it('detects each Jinja delimiter', () => {
    expect(isTemplate('{{ states("x") }}')).toBe(true);
    expect(isTemplate('{% if x %}a{% endif %}')).toBe(true);
    expect(isTemplate('{# note #}')).toBe(true);
  });

  it('rejects literals and undefined', () => {
    expect(isTemplate('Living Room')).toBe(false);
    expect(isTemplate('')).toBe(false);
    expect(isTemplate(undefined)).toBe(false);
  });
});

describe('TemplateManager', () => {
  it('resolves literals as-is and undefined to empty', () => {
    const mgr = new TemplateManager(() => undefined);
    expect(mgr.resolve('plain')).toBe('plain');
    expect(mgr.resolve(undefined)).toBe('');
  });

  it('returns empty for a template until its first result arrives', () => {
    const { hass, emit } = makeHass();
    const onChange = vi.fn();
    const mgr = new TemplateManager(onChange);
    mgr.setHass(hass);
    mgr.collect({ body: [{ type: 'item', title: '{{ name }}', tap_action: TAP }] });
    expect(mgr.resolve('{{ name }}')).toBe('');
    emit('{{ name }}', 'Sam');
    expect(mgr.resolve('{{ name }}')).toBe('Sam');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('subscribes once per unique template across every region', () => {
    const { hass, subs } = makeHass();
    const mgr = new TemplateManager(() => undefined);
    mgr.setHass(hass);
    const config: DashboardSidebarConfig = {
      header: [{ type: 'title', text: '{{ a }}', text_color: '{{ b }}' }],
      body: [
        { type: 'item', title: '{{ a }}', icon: 'mdi:home', tap_action: TAP }, // dup {{ a }}, literal icon
        {
          type: 'category',
          title: 'Rooms',
          items: [{ title: '{{ c }}', tap_action: TAP }],
        },
      ],
      footer: { buttons: [{ icon: '{{ b }}', tap_action: TAP }] }, // dup {{ b }}
    };
    mgr.collect(config);
    expect(subs.map((s) => s.template).sort()).toEqual(['{{ a }}', '{{ b }}', '{{ c }}']);
  });

  it('does not descend into card blocks (the card handles its own templating)', () => {
    const { hass, subs } = makeHass();
    const mgr = new TemplateManager(() => undefined);
    mgr.setHass(hass);
    mgr.collect({ body: [{ type: 'card', card: { type: 'markdown', content: '{{ x }}' } }] });
    expect(subs).toHaveLength(0);
  });

  it('defers subscription until a connected hass arrives', () => {
    const { hass, subs } = makeHass();
    const mgr = new TemplateManager(() => undefined);
    // Collected before any hass: cached but not subscribed.
    mgr.collect({ body: [{ type: 'item', title: '{{ a }}', tap_action: TAP }] });
    expect(subs).toHaveLength(0);
    // First connected hass flushes the pending template.
    mgr.setHass(hass);
    expect(subs.map((s) => s.template)).toEqual(['{{ a }}']);
  });

  it('unsubscribes and drops the cache on clear', async () => {
    const { hass, subs } = makeHass();
    const mgr = new TemplateManager(() => undefined);
    mgr.setHass(hass);
    mgr.collect({ body: [{ type: 'item', title: '{{ a }}', tap_action: TAP }] });
    // Let the subscribe promise resolve so unsub is attached.
    await Promise.resolve();
    mgr.clear();
    await Promise.resolve();
    expect(subs[0].unsub).toHaveBeenCalledTimes(1);
    expect(mgr.resolve('{{ a }}')).toBe('');
  });
});
