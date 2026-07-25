import type { SidebarCategoryConfig, SidebarDividerConfig, SidebarEntry } from './types';

/**
 * Type guard for the divider entry, which draws a horizontal rule and carries
 * no other data.
 */
export function isDivider(entry: SidebarEntry): entry is SidebarDividerConfig {
  return entry.type === 'divider';
}

/**
 * Type guard for a category entry. A category is anything explicitly typed
 * `category`, or, for terser configs, any non-item, non-divider entry that
 * carries a sub-item list.
 */
export function isCategory(entry: SidebarEntry): entry is SidebarCategoryConfig {
  if (entry.type === 'category') {
    return true;
  }
  if (entry.type === 'item' || entry.type === 'divider') {
    return false;
  }
  return Array.isArray((entry as SidebarCategoryConfig).items);
}
