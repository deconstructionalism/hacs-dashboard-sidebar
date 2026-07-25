import { CONFIG_KEY, DEFAULT_COLLAPSED_WIDTH, DEFAULT_WIDTH } from './const';
import { TOGGLE_EVENT, type DashboardSidebar } from './dashboard-sidebar';
import type { DashboardSidebarConfig } from './types';

const WRAPPER_ID = 'dashboard-sidebar-wrapper';
const HOST_ID = 'dashboard-sidebar-host';
const STYLE_ID = 'dashboard-sidebar-style';

type AnyEl = (Element & { shadowRoot?: ShadowRoot | null }) | null;

function descend(root: AnyEl, selector: string): AnyEl {
  return (
    (root?.shadowRoot ?? (root as unknown as ShadowRoot | null))?.querySelector(selector) ?? null
  );
}

/** Walks the frontend shadow tree down to the hui-root element. */
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

function getHass(): any {
  return (document.querySelector('home-assistant') as any)?.hass;
}

/** Height of the dashboard header, so the sidebar can start below it. */
function getHeaderHeight(shadow: ShadowRoot): number {
  const header =
    shadow.querySelector('ch-header') ??
    shadow.querySelector('app-header') ??
    shadow.querySelector('.header') ??
    shadow.querySelector('.toolbar');
  return header ? (header as HTMLElement).offsetHeight : 0;
}

/** Pushes the sidebar host below the (possibly floating) header. */
function applyHeaderOffset(shadow: ShadowRoot, host: HTMLElement): void {
  host.style.paddingTop = `${getHeaderHeight(shadow)}px`;
}

function readConfig(huiRoot: { lovelace?: any }): DashboardSidebarConfig | null {
  const config = huiRoot.lovelace?.config?.[CONFIG_KEY];
  return config ?? null;
}

function widthCss(config: DashboardSidebarConfig): string {
  const expanded = config.width ?? DEFAULT_WIDTH;
  const collapsed = config.collapsed_width ?? DEFAULT_COLLAPSED_WIDTH;
  return `
    #${WRAPPER_ID} {
      display: flex;
      flex-direction: row;
      height: 100%;
      width: 100%;
    }
    #${HOST_ID} {
      flex: 0 0 auto;
      width: ${expanded}px;
      box-sizing: border-box;
      overflow: visible;
      transition: width 0.25s ease;
    }
    #${WRAPPER_ID}.collapsed #${HOST_ID} {
      width: ${collapsed}px;
    }
    #${WRAPPER_ID} > #view {
      flex: 1 1 0;
      min-width: 0;
    }
  `;
}

function buildSidebar(): void {
  const huiRoot = getHuiRoot();
  if (!huiRoot) {
    return;
  }
  const config = readConfig(huiRoot);
  const shadow = huiRoot.shadowRoot;
  const existing = shadow.getElementById(WRAPPER_ID);

  if (!config) {
    return;
  }
  if (existing) {
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
  style.textContent = widthCss(config);

  const wrapper = document.createElement('div');
  wrapper.id = WRAPPER_ID;
  view.parentNode.insertBefore(wrapper, view);

  const host = document.createElement('div');
  host.id = HOST_ID;
  applyHeaderOffset(shadow, host);
  const element = document.createElement('dashboard-sidebar') as DashboardSidebar;
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
}

/** Rebuilds the sidebar after the frontend swaps the view, and keeps hass fresh. */
function ensureSidebar(): void {
  try {
    const huiRoot = getHuiRoot();
    if (!huiRoot) {
      return;
    }
    const wrapper = huiRoot.shadowRoot.getElementById(WRAPPER_ID);
    if (!wrapper) {
      buildSidebar();
      return;
    }
    const host = huiRoot.shadowRoot.getElementById(HOST_ID);
    if (host) {
      applyHeaderOffset(huiRoot.shadowRoot, host);
    }
    const element = wrapper.querySelector('dashboard-sidebar') as DashboardSidebar | null;
    if (element && !element.hass) {
      element.hass = getHass();
    }
  } catch {
    // frontend not ready yet; the next tick retries
  }
}

export function startSidebar(): void {
  window.addEventListener('location-changed', () => ensureSidebar());
  window.setInterval(ensureSidebar, 1000);
  ensureSidebar();
}
