import type { ActionConfig } from 'custom-card-helpers';

import type {
  BlockType,
  FooterButtonConfig,
  Region,
  SidebarBlock,
  DashboardSidebarConfig,
} from '../lib/types';

/** A block's location within one sidebar. */
export interface BlockLocation {
  /** Which region the block is in. */
  region: Region;
  /** The block's index within that region. */
  index: number;
}

/** The default tap action for newly added items and footer buttons. */
const NO_ACTION = { action: 'none' } as unknown as ActionConfig;

/**
 * Whether a block may live in the given region. A title block is confined to
 * the header, so it can never be placed in the body.
 */
export function canPlace(block: SidebarBlock, region: Region): boolean {
  return !(block.type === 'title' && region === 'body');
}

/**
 * Moves a block between regions/indices within one sidebar, returning a new
 * config. A move the title-in-header rule forbids returns the input unchanged.
 */
export function moveBlock(
  config: DashboardSidebarConfig,
  from: BlockLocation,
  to: BlockLocation,
): DashboardSidebarConfig {
  const header = [...(config.header ?? [])];
  const body = [...(config.body ?? [])];
  const src = from.region === 'header' ? header : body;
  const block = src[from.index];
  if (!block || !canPlace(block, to.region)) {
    return config;
  }
  src.splice(from.index, 1);
  const dst = to.region === 'header' ? header : body;
  const index = Math.max(0, Math.min(to.index, dst.length));
  dst.splice(index, 0, block);
  return { ...config, header, body };
}

/**
 * Creates a new block of the given type with sensible defaults.
 */
export function defaultBlock(type: BlockType): SidebarBlock {
  switch (type) {
    case 'title':
      return { type: 'title', text: 'Title' };
    case 'clock':
      return { type: 'clock' };
    case 'date':
      return { type: 'date' };
    case 'divider':
      return { type: 'divider' };
    case 'item':
      return { type: 'item', title: 'Item', tap_action: NO_ACTION };
    case 'category':
      return {
        type: 'category',
        title: 'Category',
        items: [{ type: 'item', title: 'Item', tap_action: NO_ACTION }],
      };
    case 'markdown':
      return { type: 'markdown', content: 'Markdown **content**' };
    case 'card':
    default:
      return { type: 'card', card: { type: 'markdown', content: 'Card content' } };
  }
}

/**
 * Creates a new footer button with sensible defaults.
 */
export function defaultFooterButton(): FooterButtonConfig {
  return { icon: 'mdi:star', tap_action: NO_ACTION };
}

/**
 * Creates a starter sidebar config for a newly added side.
 */
export function starterSidebar(): DashboardSidebarConfig {
  return { body: [{ type: 'item', title: 'Item', tap_action: NO_ACTION }] };
}
