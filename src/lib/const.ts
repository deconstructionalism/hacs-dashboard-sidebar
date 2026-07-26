/** Semantic version stamped into the browser-console startup banner. */
export const CARD_VERSION = '0.2.0';

/** Top-level Lovelace config key the sidebar reads its configuration from. */
export const CONFIG_KEY = 'dashboard_sidebar';

/** Expanded sidebar width in pixels used when the config omits `width`. */
export const DEFAULT_WIDTH = 240;

/** Fixed sidebar width in pixels while the sidebar is collapsed. */
export const DEFAULT_COLLAPSED_WIDTH = 64;

/** localStorage key prefix that stores the per-view collapsed state. */
export const STORAGE_PREFIX = 'dashboard-sidebar-collapsed';

/**
 * Name of the bubbling, composed event the element fires whenever its
 * collapsed state flips, so the injected chrome can resize the wrapper.
 */
export const TOGGLE_EVENT = 'dashboard-sidebar-toggle';

/**
 * Name of the bubbling, composed event the element fires when its edit button
 * is pressed, so the bootstrap can open the editor for that side.
 */
export const EDIT_EVENT = 'dashboard-sidebar-edit';
