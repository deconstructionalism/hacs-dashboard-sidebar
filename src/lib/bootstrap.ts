import {
  CONFIG_KEY,
  DEFAULT_COLLAPSED_WIDTH,
  DEFAULT_WIDTH,
  EDIT_EVENT,
  TOGGLE_EVENT,
} from './const';
import type { DashboardSidebarConfig, SidebarConfig, SidebarPosition } from './types';
import type { DashboardSidebar } from '../dashboard-sidebar';
import type { DashboardSidebarEditor } from '../editor/sidebar-editor';

/** DOM id of the flex wrapper that holds the sidebar hosts and the view. */
const WRAPPER_ID = 'dashboard-sidebar-wrapper';

/** DOM id of the injected `<style>` element that lays out the wrapper. */
const STYLE_ID = 'dashboard-sidebar-style';

/** DOM id of the floating "add sidebar" button shown when none exists yet. */
const ADD_BUTTON_ID = 'dashboard-sidebar-add';

/** The two sides a sidebar can dock to. */
const SIDES: SidebarPosition[] = ['left', 'right'];

/** An element that may expose a shadow root, or null. */
type AnyEl = (Element & { shadowRoot?: ShadowRoot | null }) | null;

/**
 * The DOM id of the sticky host element for one side's sidebar.
 */
function hostId(side: SidebarPosition): string {
  return `dashboard-sidebar-host-${side}`;
}

/**
 * Descends one level into an element's shadow root (or the element itself when
 * it already is a shadow root) and returns the first matching child.
 */
function descend(root: AnyEl, selector: string): AnyEl {
  return (
    (root?.shadowRoot ?? (root as unknown as ShadowRoot | null))?.querySelector(selector) ?? null
  );
}

/**
 * Walks the frontend shadow tree down to the `hui-root` element that owns the
 * current Lovelace view, or null if the frontend is not ready.
 */
function getHuiRoot(): (Element & { shadowRoot: ShadowRoot; lovelace?: any }) | null {
  let el: AnyEl = document.querySelector('home-assistant');
  el = descend(el, 'home-assistant-main');
  const panel =
    descend(el, 'ha-drawer partial-panel-resolver') ??
    descend(el, 'app-drawer-layout partial-panel-resolver') ??
    descend(el, 'partial-panel-resolver');
  el = descend(panel, 'ha-panel-lovelace') ?? panel;
  el = descend(el, 'hui-root');
  return el && el.shadowRoot ? (el as any) : null;
}

/**
 * Returns the global Home Assistant object from the root element.
 */
function getHass(): any {
  return (document.querySelector('home-assistant') as any)?.hass;
}

/**
 * Whether the dashboard is currently in edit mode.
 */
function isEditMode(huiRoot: { lovelace?: any }): boolean {
  return Boolean(huiRoot.lovelace?.editMode);
}

/**
 * Measures the height of the dashboard header so the sidebar can start below
 * it rather than under a floating toolbar.
 */
function getHeaderHeight(shadow: ShadowRoot): number {
  const header =
    shadow.querySelector('ch-header') ??
    shadow.querySelector('app-header') ??
    shadow.querySelector('.header') ??
    shadow.querySelector('.toolbar');
  return header ? (header as HTMLElement).offsetHeight : 0;
}

/**
 * Pushes a sidebar host down by the current header height.
 */
function applyHeaderOffset(shadow: ShadowRoot, host: HTMLElement): void {
  host.style.paddingTop = `${getHeaderHeight(shadow)}px`;
}

/**
 * Reads the dashboard_sidebar container from the Lovelace config, or null when
 * absent.
 */
function readConfig(huiRoot: { lovelace?: any }): DashboardSidebarConfig | null {
  const config = huiRoot.lovelace?.config?.[CONFIG_KEY];
  return config ?? null;
}

/**
 * Whether a container has at least one side configured.
 */
function hasAnySide(config: DashboardSidebarConfig | null): boolean {
  return Boolean(config && (config.left || config.right));
}

/**
 * Writes the edited container back to the Lovelace config.
 */
function saveConfig(huiRoot: { lovelace?: any }, config: DashboardSidebarConfig): void {
  const lovelace = huiRoot.lovelace;
  if (!lovelace?.saveConfig) {
    return;
  }
  void lovelace.saveConfig({ ...(lovelace.config ?? {}), [CONFIG_KEY]: config });
}

/**
 * Builds the sticky-host layout CSS for one side, including its collapsed width
 * and optional hide-on-mobile media query.
 */
function sideHostCss(side: SidebarPosition, config: SidebarConfig): string {
  const expanded = config.width ?? DEFAULT_WIDTH;
  const collapsed = DEFAULT_COLLAPSED_WIDTH;
  const host = hostId(side);
  return `
    #${host} {
      flex: 0 0 auto;
      width: ${expanded}px;
      box-sizing: border-box;
      overflow: visible;
      align-self: flex-start;
      position: sticky;
      top: 0;
      height: 100vh;
      z-index: 5;
      transition: width 0.25s ease;
    }
    #${WRAPPER_ID}.collapsed-${side} #${host} {
      width: ${collapsed}px;
    }
    ${config.hide_on_mobile ? `@media (max-width: 768px) { #${host} { display: none; } }` : ''}
  `;
}

/**
 * Builds the full wrapper layout CSS for the present sides.
 */
function wrapperCss(config: DashboardSidebarConfig): string {
  return `
    #${WRAPPER_ID} {
      display: flex;
      flex-direction: row;
      height: 100%;
      width: 100%;
    }
    #${WRAPPER_ID} > #view {
      flex: 1 1 0;
      min-width: 0;
    }
    ${config.left ? sideHostCss('left', config.left) : ''}
    ${config.right ? sideHostCss('right', config.right) : ''}
  `;
}

/**
 * Creates a host and mounts a sidebar element for one side.
 */
function mountSide(
  shadow: ShadowRoot,
  side: SidebarPosition,
  config: SidebarConfig,
  editMode: boolean,
): HTMLElement {
  const host = document.createElement('div');
  host.id = hostId(side);
  applyHeaderOffset(shadow, host);
  const element = document.createElement('dashboard-sidebar') as DashboardSidebar;
  element.side = side;
  element.editMode = editMode;
  element.hass = getHass();
  element.setConfig(config);
  host.appendChild(element);
  return host;
}

/**
 * Creates the wrapper, hosts, and sidebar elements and inserts them around the
 * current view, once per view. No-ops when the config, view, or a prior wrapper
 * says there is nothing to do.
 */
function buildSidebar(): void {
  const huiRoot = getHuiRoot();
  if (!huiRoot) {
    return;
  }
  const config = readConfig(huiRoot);
  const shadow = huiRoot.shadowRoot;

  if (!hasAnySide(config) || !config) {
    return;
  }
  if (shadow.getElementById(WRAPPER_ID)) {
    return;
  }
  const view = shadow.getElementById('view');
  if (!view || !view.parentNode) {
    return;
  }

  let style = shadow.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    shadow.appendChild(style);
  }
  style.textContent = wrapperCss(config);

  const editMode = isEditMode(huiRoot);
  const wrapper = document.createElement('div');
  wrapper.id = WRAPPER_ID;
  wrapper.dataset.cfg = JSON.stringify(config);
  view.parentNode.insertBefore(wrapper, view);

  if (config.left) {
    wrapper.appendChild(mountSide(shadow, 'left', config.left, editMode));
  }
  wrapper.appendChild(view);
  if (config.right) {
    wrapper.appendChild(mountSide(shadow, 'right', config.right, editMode));
  }

  wrapper.addEventListener(TOGGLE_EVENT, (ev: Event) => {
    const detail = (ev as CustomEvent).detail ?? {};
    const side = detail.side === 'right' ? 'right' : 'left';
    wrapper.classList.toggle(`collapsed-${side}`, Boolean(detail.collapsed));
  });
}

/**
 * Unwraps the view and removes the wrapper, so the next build re-reads config.
 */
function teardown(shadow: ShadowRoot): void {
  const wrapper = shadow.getElementById(WRAPPER_ID);
  if (!wrapper) {
    return;
  }
  const view = shadow.getElementById('view');
  if (view && wrapper.parentNode) {
    wrapper.parentNode.insertBefore(view, wrapper);
  }
  wrapper.remove();
}

/**
 * Opens the editor for a side, unless it is already open.
 */
function openEditor(
  huiRoot: { shadowRoot: ShadowRoot; lovelace?: any },
  side: SidebarPosition,
): void {
  const shadow = huiRoot.shadowRoot;
  if (shadow.querySelector('dashboard-sidebar-editor')) {
    return;
  }
  const editor = document.createElement('dashboard-sidebar-editor') as DashboardSidebarEditor;
  editor.hass = getHass();
  editor.config = readConfig(huiRoot) ?? {};
  editor.focusSide = side;
  editor.onSave = (config) => saveConfig(huiRoot, config);
  editor.onClose = () => editor.remove();
  shadow.appendChild(editor);
}

/**
 * Shows a floating "add sidebar" button while editing a sidebar-less dashboard.
 */
function ensureAddButton(huiRoot: { shadowRoot: ShadowRoot; lovelace?: any }): void {
  const shadow = huiRoot.shadowRoot;
  if (shadow.getElementById(ADD_BUTTON_ID)) {
    return;
  }
  const btn = document.createElement('button');
  btn.id = ADD_BUTTON_ID;
  btn.textContent = '＋ Sidebar';
  btn.style.cssText =
    'position:fixed;bottom:24px;left:24px;z-index:6;padding:10px 16px;border:none;' +
    'border-radius:20px;background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff);' +
    'cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);font:inherit;';
  btn.addEventListener('click', () => openEditor(huiRoot, 'left'));
  shadow.appendChild(btn);
}

/**
 * Removes the floating add button if present.
 */
function removeAddButton(shadow: ShadowRoot): void {
  shadow.getElementById(ADD_BUTTON_ID)?.remove();
}

/**
 * Rebuilds the sidebars after the frontend swaps the view or the config
 * changes, keeps each element's hass and edit mode fresh, and manages the
 * add-sidebar affordance. Errors mid-transition are swallowed for the next tick.
 */
function ensureSidebar(): void {
  try {
    const huiRoot = getHuiRoot();
    if (!huiRoot) {
      return;
    }
    const shadow = huiRoot.shadowRoot;
    const editMode = isEditMode(huiRoot);
    const config = readConfig(huiRoot);
    const wrapper = shadow.getElementById(WRAPPER_ID);

    if (!wrapper) {
      if (hasAnySide(config)) {
        buildSidebar();
      } else if (editMode) {
        ensureAddButton(huiRoot);
      } else {
        removeAddButton(shadow);
      }
      return;
    }

    removeAddButton(shadow);

    // Rebuild when the config changed (e.g. the editor saved).
    if (wrapper.dataset.cfg !== JSON.stringify(config ?? {})) {
      teardown(shadow);
      buildSidebar();
      return;
    }

    SIDES.forEach((side) => {
      const host = shadow.getElementById(hostId(side));
      if (host) {
        applyHeaderOffset(shadow, host);
      }
    });
    wrapper.querySelectorAll('dashboard-sidebar').forEach((el) => {
      const element = el as DashboardSidebar;
      element.editMode = editMode;
      if (!element.hass) {
        element.hass = getHass();
      }
    });
  } catch {
    // frontend not ready yet; the next tick retries
  }
}

/**
 * Starts the sidebars: builds now, on every navigation, on a slow poll, and
 * opens the editor when a sidebar requests it.
 */
export function startSidebar(): void {
  window.addEventListener('location-changed', () => ensureSidebar());
  window.addEventListener(EDIT_EVENT, (ev: Event) => {
    const side = (ev as CustomEvent).detail?.side === 'right' ? 'right' : 'left';
    const huiRoot = getHuiRoot();
    if (huiRoot) {
      openEditor(huiRoot, side);
    }
  });
  window.setInterval(ensureSidebar, 1000);
  ensureSidebar();
}
