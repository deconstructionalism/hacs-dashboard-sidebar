import {
  CONFIG_KEY,
  DEFAULT_COLLAPSED_WIDTH,
  DEFAULT_WIDTH,
  EDIT_EVENT,
  TOGGLE_EVENT,
} from './const';
import type { DashboardSidebarConfig } from './types';
import type { DashboardSidebar } from '../dashboard-sidebar';
import type { DashboardSidebarEditor } from '../editor/sidebar-editor';

/** DOM id of the flex wrapper that holds the sidebar host and the view. */
const WRAPPER_ID = 'dashboard-sidebar-wrapper';

/** DOM id of the sticky host element the sidebar renders into. */
const HOST_ID = 'dashboard-sidebar-host';

/** DOM id of the injected `<style>` element that lays out the wrapper. */
const STYLE_ID = 'dashboard-sidebar-style';

/** DOM id of the floating "add sidebar" button shown when none exists yet. */
const ADD_BUTTON_ID = 'dashboard-sidebar-add';

/**
 * Builds the starter sidebar seeded on first add, tailored to the instance: a
 * centered clock and date plus a greeting in the header, one navigate link per
 * dashboard view (using each view's icon) in the body, and a few of the
 * instance's lights as footer toggle buttons (colored by state).
 */
export const starterConfig = (hass: any, lovelace: any): DashboardSidebarConfig => {
  // Greet by name. Home Assistant's server-side templates do not reliably
  // expose the current user, so bake the name in from hass at seed time.
  const name = typeof hass?.user?.name === 'string' ? hass.user.name.trim() : '';
  const header = [
    { type: 'clock', align: 'center' },
    { type: 'date', align: 'center' },
    { type: 'title', text: name ? `Hello ${name}` : 'Hello', align: 'center' },
  ];

  // The base path is the current dashboard's URL segment (e.g. /lovelace or
  // /my-dashboard); each non-subview becomes a navigate link to its view.
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const base = `/${pathname.split('/')[1] || 'lovelace'}`;
  const views: any[] = Array.isArray(lovelace?.config?.views) ? lovelace.config.views : [];
  const body = views
    .filter((v) => v?.subview !== true)
    .map((v, i) => ({
      type: 'item',
      title: v.title || v.path || `View ${i + 1}`,
      icon: v.icon || 'mdi:view-dashboard',
      tap_action: { action: 'navigate', navigation_path: `${base}/${v.path ?? i}` },
    }));

  // Up to four lights from the instance, as footer buttons that toggle them.
  const states = hass?.states ?? {};
  const buttons = Object.keys(states)
    .filter((id) => id.startsWith('light.'))
    .slice(0, 4)
    .map((id) => ({
      icon: states[id]?.attributes?.icon || 'mdi:lightbulb',
      icon_color: `{{ '#ffb74d' if is_state('${id}', 'on') else 'var(--secondary-text-color)' }}`,
      title: states[id]?.attributes?.friendly_name || id,
      entity: id,
      tap_action: { action: 'toggle', entity: id },
    }));

  const config: DashboardSidebarConfig = { position: 'left', header: header as never };
  if (body.length) {
    config.body = body as never;
  }
  if (buttons.length) {
    config.footer = { buttons: buttons as never };
  }
  return config;
};

/** An element that may expose a shadow root, or null. */
type AnyEl = (Element & { shadowRoot?: ShadowRoot | null }) | null;

/**
 * Descends one level into an element's shadow root (or the element itself when
 * it already is a shadow root) and returns the first matching child.
 */
const descend = (root: AnyEl, selector: string): AnyEl => {
  return (
    (root?.shadowRoot ?? (root as unknown as ShadowRoot | null))?.querySelector(selector) ?? null
  );
};

/**
 * Walks the frontend shadow tree down to the `hui-root` element that owns the
 * current Lovelace view, or null if the frontend is not ready.
 */
const getHuiRoot = (): (Element & { shadowRoot: ShadowRoot; lovelace?: any }) | null => {
  let el: AnyEl = document.querySelector('home-assistant');
  el = descend(el, 'home-assistant-main');
  const panel =
    descend(el, 'ha-drawer partial-panel-resolver') ??
    descend(el, 'app-drawer-layout partial-panel-resolver') ??
    descend(el, 'partial-panel-resolver');
  el = descend(panel, 'ha-panel-lovelace') ?? panel;
  el = descend(el, 'hui-root');
  return el && el.shadowRoot ? (el as any) : null;
};

/**
 * Returns the global Home Assistant object from the root element.
 */
const getHass = (): any => {
  return (document.querySelector('home-assistant') as any)?.hass;
};

/**
 * Whether the dashboard is currently in edit mode.
 */
const isEditMode = (huiRoot: { lovelace?: any }): boolean => {
  return Boolean(huiRoot.lovelace?.editMode);
};

/**
 * Measures the height of the dashboard header so the sidebar can start below
 * it rather than under a floating toolbar.
 */
const getHeaderHeight = (shadow: ShadowRoot): number => {
  const header =
    shadow.querySelector('ch-header') ??
    shadow.querySelector('app-header') ??
    shadow.querySelector('.header') ??
    shadow.querySelector('.toolbar');
  return header ? (header as HTMLElement).offsetHeight : 0;
};

/**
 * Records the current header height as a CSS variable so the host can sit
 * entirely below the header (via margin, not padding), keeping its box — which
 * is stacked above the view — from overlapping the header's controls.
 */
const applyHeaderOffset = (shadow: ShadowRoot, host: HTMLElement): void => {
  host.style.setProperty('--dsb-header', `${getHeaderHeight(shadow)}px`);
};

/**
 * Reads the sidebar config from the Lovelace config, or null when absent.
 */
const readConfig = (huiRoot: { lovelace?: any }): DashboardSidebarConfig | null => {
  const config = huiRoot.lovelace?.config?.[CONFIG_KEY];
  return config ?? null;
};

/**
 * Writes an edited config back to the Lovelace config.
 */
const saveConfig = (huiRoot: { lovelace?: any }, config: DashboardSidebarConfig): void => {
  const lovelace = huiRoot.lovelace;
  if (!lovelace?.saveConfig) {
    return;
  }
  void lovelace.saveConfig({ ...(lovelace.config ?? {}), [CONFIG_KEY]: config });
};

/**
 * Removes the sidebar from the Lovelace config. The reconcile loop then tears
 * down the rendered sidebar on its next pass (config is gone).
 */
const deleteConfig = (huiRoot: { lovelace?: any }): void => {
  const lovelace = huiRoot.lovelace;
  if (!lovelace?.saveConfig) {
    return;
  }
  const next = { ...(lovelace.config ?? {}) };
  delete next[CONFIG_KEY];
  void lovelace.saveConfig(next);
};

/**
 * A key that changes only when the host layout (side or width) must be rebuilt,
 * so pure content edits can update the element in place instead.
 */
const structureKey = (config: DashboardSidebarConfig): string => {
  return `${config.position ?? 'left'}:${config.width ?? DEFAULT_WIDTH}:${config.hide_on_mobile ? 1 : 0}`;
};

/**
 * Builds the wrapper/host layout CSS, including the collapsed width and the
 * optional hide-on-mobile media query.
 */
const wrapperCss = (config: DashboardSidebarConfig): string => {
  const expanded = config.width ?? DEFAULT_WIDTH;
  const collapsed = DEFAULT_COLLAPSED_WIDTH;
  return `
    #${WRAPPER_ID} {
      display: flex;
      flex-direction: row;
      height: 100%;
      width: 100%;
    }
    #${HOST_ID} {
      flex: 0 0 auto;
      /* Clamp to the viewport so a mistyped width can never overflow the page. */
      width: min(${expanded}px, 100vw);
      box-sizing: border-box;
      overflow: visible;
      align-self: flex-start;
      position: sticky;
      top: var(--dsb-header, 0px);
      margin-top: var(--dsb-header, 0px);
      height: calc(100vh - var(--dsb-header, 0px));
      z-index: 5;
      transition: width 0.25s ease;
    }
    #${WRAPPER_ID}.collapsed #${HOST_ID} {
      width: ${collapsed}px;
    }
    #${WRAPPER_ID} > #view {
      flex: 1 1 0;
      min-width: 0;
    }
    ${
      config.hide_on_mobile
        ? `@media (max-width: 768px) {
             #${HOST_ID} { display: none; }
             #${WRAPPER_ID} > #view { flex-basis: 100%; }
           }`
        : ''
    }
  `;
};

/**
 * Creates the wrapper, host, and sidebar element and inserts them around the
 * current view, once per view. No-ops when the config, view, or a prior wrapper
 * says there is nothing to do.
 */
const buildSidebar = (): void => {
  const huiRoot = getHuiRoot();
  if (!huiRoot) {
    return;
  }
  const config = readConfig(huiRoot);
  const shadow = huiRoot.shadowRoot;

  if (!config) {
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

  const wrapper = document.createElement('div');
  wrapper.id = WRAPPER_ID;
  wrapper.dataset.cfg = JSON.stringify(config);
  wrapper.dataset.struct = structureKey(config);
  view.parentNode.insertBefore(wrapper, view);

  const host = document.createElement('div');
  host.id = HOST_ID;
  applyHeaderOffset(shadow, host);
  const element = document.createElement('dashboard-sidebar') as DashboardSidebar;
  element.editMode = isEditMode(huiRoot);
  element.hass = getHass();
  element.setConfig(config);
  host.appendChild(element);

  if (config.position === 'right') {
    wrapper.appendChild(view);
    wrapper.appendChild(host);
  } else {
    wrapper.appendChild(host);
    wrapper.appendChild(view);
  }

  wrapper.addEventListener(TOGGLE_EVENT, (ev: Event) => {
    const collapsed = Boolean((ev as CustomEvent).detail?.collapsed);
    wrapper.classList.toggle('collapsed', collapsed);
  });
};

/**
 * Unwraps the view and removes the wrapper, so the next build re-reads config.
 */
const teardown = (shadow: ShadowRoot): void => {
  const wrapper = shadow.getElementById(WRAPPER_ID);
  if (!wrapper) {
    return;
  }
  const view = shadow.getElementById('view');
  if (view && wrapper.parentNode) {
    wrapper.parentNode.insertBefore(view, wrapper);
  }
  wrapper.remove();
};

/**
 * Shows a floating "add sidebar" button while editing a sidebar-less dashboard.
 * A plain pill in the bottom-left, offset past the HA sidebar so it never sits
 * over the nav rail.
 */
const ensureAddButton = (huiRoot: { shadowRoot: ShadowRoot; lovelace?: any }): void => {
  const shadow = huiRoot.shadowRoot;
  let btn = shadow.getElementById(ADD_BUTTON_ID) as HTMLButtonElement | null;
  if (!btn) {
    btn = document.createElement('button');
    btn.id = ADD_BUTTON_ID;
    btn.textContent = '＋ Sidebar';
    btn.style.cssText =
      'position:fixed;z-index:6;bottom:24px;left:16px;padding:10px 16px;border:none;' +
      'border-radius:20px;background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff);' +
      'cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);font:inherit;';
    btn.addEventListener('click', () =>
      saveConfig(huiRoot, starterConfig(getHass(), huiRoot.lovelace)),
    );
    shadow.appendChild(btn);
  }
  // The dashboard content starts to the right of the HA sidebar, so anchor the
  // button to that left edge (updated live as the sidebar collapses/expands).
  const contentLeft = (huiRoot as unknown as HTMLElement).getBoundingClientRect?.().left ?? 0;
  btn.style.left = `${Math.round(contentLeft) + 16}px`;
};

/**
 * Removes the floating add button if present.
 */
const removeAddButton = (shadow: ShadowRoot): void => {
  shadow.getElementById(ADD_BUTTON_ID)?.remove();
};

/**
 * Opens the editor modal for the current config, unless it is already open.
 */
const openEditor = (huiRoot: { shadowRoot: ShadowRoot; lovelace?: any }): void => {
  const shadow = huiRoot.shadowRoot;
  if (shadow.querySelector('dashboard-sidebar-editor')) {
    return;
  }
  const editor = document.createElement('dashboard-sidebar-editor') as DashboardSidebarEditor;
  editor.hass = getHass();
  editor.config = readConfig(huiRoot) ?? {};
  editor.onSave = (config) => saveConfig(huiRoot, config);
  editor.onClose = () => editor.remove();
  editor.onDelete = () => deleteConfig(huiRoot);
  shadow.appendChild(editor);
};

/**
 * Rebuilds the sidebar after the frontend swaps the view or the config changes,
 * keeps hass and edit mode fresh, and manages the add-sidebar affordance.
 * A content-only change updates the element in place to avoid flicker.
 */
const ensureSidebar = (): void => {
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
      if (config) {
        buildSidebar();
      } else if (editMode) {
        ensureAddButton(huiRoot);
      } else {
        removeAddButton(shadow);
      }
      return;
    }

    removeAddButton(shadow);
    const element = wrapper.querySelector('dashboard-sidebar') as DashboardSidebar | null;

    if (wrapper.dataset.cfg !== JSON.stringify(config ?? null)) {
      const sameStructure = Boolean(
        config && element && wrapper.dataset.struct === structureKey(config),
      );
      if (config && sameStructure && element) {
        element.setConfig(config);
        wrapper.dataset.cfg = JSON.stringify(config);
      } else {
        teardown(shadow);
        buildSidebar();
      }
      return;
    }

    const host = shadow.getElementById(HOST_ID);
    if (host) {
      applyHeaderOffset(shadow, host);
    }
    if (element) {
      element.editMode = editMode;
      // Keep hass current (not just set once) so state-dependent actions like
      // toggle read the live state, and manual cards stay up to date. Home
      // Assistant replaces the hass object on each change, so this is a no-op
      // reference assignment until something actually changed.
      element.hass = getHass();
    }
  } catch {
    // frontend not ready yet; the next tick retries
  }
};

/**
 * Starts the sidebar: builds now, on every navigation, on a slow poll, and
 * persists in-place edits the element reports.
 */
export const startSidebar = (): void => {
  window.addEventListener('location-changed', () => ensureSidebar());
  window.addEventListener(EDIT_EVENT, () => {
    const huiRoot = getHuiRoot();
    if (huiRoot) {
      openEditor(huiRoot);
    }
  });
  window.setInterval(ensureSidebar, 1000);
  ensureSidebar();
};
