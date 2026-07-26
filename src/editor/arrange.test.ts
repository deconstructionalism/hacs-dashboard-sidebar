import { describe, expect, it } from 'vitest';

import type { DashboardSidebarConfig } from '../lib/types';
import { validateConfig } from '../lib/validate';
import { canPlace, defaultBlock, defaultFooterButton, moveBlock, starterSidebar } from './arrange';

/** A two-region sidebar the move cases operate on. */
const cfg = (): DashboardSidebarConfig => ({
  header: [{ type: 'title', text: 'Home' }, { type: 'clock' }],
  body: [{ type: 'item', title: 'A', tap_action: { action: 'toggle' } }, { type: 'divider' }],
});

/** Maps a region's blocks to their types for concise assertions. */
const types = (blocks: DashboardSidebarConfig['header']): string[] =>
  (blocks ?? []).map((b) => b.type ?? 'item');

describe('moveBlock', () => {
  it('reorders within a region', () => {
    const r = moveBlock(cfg(), { region: 'header', index: 0 }, { region: 'header', index: 1 });
    expect(types(r.header)).toEqual(['clock', 'title']);
  });

  it('moves a block from body into header', () => {
    const r = moveBlock(cfg(), { region: 'body', index: 0 }, { region: 'header', index: 0 });
    expect(types(r.header)).toEqual(['item', 'title', 'clock']);
    expect(types(r.body)).toEqual(['divider']);
  });

  it('refuses to move a title into the body', () => {
    const before = cfg();
    const r = moveBlock(before, { region: 'header', index: 0 }, { region: 'body', index: 0 });
    expect(r).toEqual(before);
  });

  it('keeps the config valid after a move', () => {
    const r = moveBlock(cfg(), { region: 'body', index: 0 }, { region: 'header', index: 2 });
    expect(validateConfig(r)).toHaveLength(0);
  });
});

describe('canPlace', () => {
  it('confines title to the header', () => {
    expect(canPlace(defaultBlock('title'), 'body')).toBe(false);
    expect(canPlace(defaultBlock('title'), 'header')).toBe(true);
    expect(canPlace(defaultBlock('item'), 'body')).toBe(true);
  });
});

describe('factories', () => {
  it('produces valid default blocks for every type', () => {
    const types_: Array<Parameters<typeof defaultBlock>[0]> = [
      'title',
      'clock',
      'date',
      'divider',
      'item',
      'category',
      'card',
    ];
    types_.forEach((t) => {
      const region = t === 'title' ? 'header' : 'body';
      expect(validateConfig({ [region]: [defaultBlock(t)] }), t).toHaveLength(0);
    });
  });

  it('produces a valid starter sidebar and footer button', () => {
    expect(validateConfig(starterSidebar())).toHaveLength(0);
    expect(
      validateConfig({
        body: [defaultBlock('item')],
        footer: { buttons: [defaultFooterButton()] },
      }),
    ).toHaveLength(0);
  });
});
