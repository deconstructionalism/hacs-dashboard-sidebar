import {
  html,
  type ReactiveController,
  type ReactiveControllerHost,
  type TemplateResult,
} from 'lit';

/** One selectable row in a popup menu. */
export interface MenuItem {
  /** The row label. */
  label: string;
  /** Run when the row is clicked. */
  run: () => void;
}

/**
 * Fixed-position style for a menu anchored to a trigger rect: drops below the
 * trigger, or flips above it when there is more room up, and caps its height to
 * the available space (the menu scrolls internally past that). `align` pins the
 * menu's left or right edge to the trigger.
 */
export const menuStyle = (rect: DOMRect, align: 'left' | 'right'): string => {
  const margin = 8;
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const below = spaceBelow >= spaceAbove;
  const maxHeight = Math.max(120, (below ? spaceBelow : spaceAbove) - margin - 4);
  const vertical = below
    ? `top: ${rect.bottom + 4}px`
    : `bottom: ${window.innerHeight - rect.top + 4}px`;
  const horizontal =
    align === 'right'
      ? `right: ${Math.max(margin, window.innerWidth - rect.right)}px`
      : `left: ${Math.max(margin, rect.left)}px`;
  return `${vertical}; ${horizontal}; max-height: ${maxHeight}px`;
};

/**
 * A simple popup menu: a click-away scrim plus a fixed-positioned list of
 * buttons. Each item runs its action and then closes the menu.
 */
export const popupMenu = (
  rect: DOMRect,
  items: MenuItem[],
  onClose: () => void,
): TemplateResult => html`
  <div class="menu-scrim" @click=${onClose}></div>
  <div class="add-menu" style=${menuStyle(rect, 'left')}>
    ${items.map(
      (item) =>
        html`<button
          class="add-menu-item"
          @click=${() => {
            item.run();
            onClose();
          }}
        >
          ${item.label}
        </button>`,
    )}
  </div>
`;

/**
 * Owns the editor's popup-menu state: the add-element menu, the selected
 * element's overflow ("...") menu, and the current tab's options menu with its
 * "Change to" submenu. Each *Open flag is an accessor that requests a host
 * re-render when set (so the component stays reactive without @state); the
 * anchor rects and item list are plain fields, set alongside their flag.
 */
export class MenusController implements ReactiveController {
  private host: ReactiveControllerHost;

  private _addOpen = false;
  private _elementOpen = false;
  private _tabOpen = false;
  private _tabSubmenuOpen = false;

  /** Anchor rect and choices for the open add menu. */
  addRect: DOMRect | null = null;
  addItems: MenuItem[] = [];
  /** Anchor rect of the selected element's overflow menu trigger. */
  elementRect: DOMRect | null = null;
  /** Anchor rect of the tab options menu trigger. */
  tabRect: DOMRect | null = null;

  /** Registers this controller with its host component. */
  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  /** No connect-time work; the menu state lives in memory. */
  hostConnected(): void {}

  /** Whether the add-element menu is open. */
  get addOpen(): boolean {
    return this._addOpen;
  }
  /** Opens or closes the add-element menu, re-rendering the host. */
  set addOpen(v: boolean) {
    this._addOpen = v;
    this.host.requestUpdate();
  }

  /** Whether the selected element's overflow menu is open. */
  get elementOpen(): boolean {
    return this._elementOpen;
  }
  /** Opens or closes the element overflow menu, re-rendering the host. */
  set elementOpen(v: boolean) {
    this._elementOpen = v;
    this.host.requestUpdate();
  }

  /** Whether the current tab's options menu is open. */
  get tabOpen(): boolean {
    return this._tabOpen;
  }
  /** Opens or closes the tab options menu, re-rendering the host. */
  set tabOpen(v: boolean) {
    this._tabOpen = v;
    this.host.requestUpdate();
  }

  /** Whether the footer menu's "Change to" submenu is expanded. */
  get tabSubmenuOpen(): boolean {
    return this._tabSubmenuOpen;
  }
  /** Expands or collapses the "Change to" submenu, re-rendering the host. */
  set tabSubmenuOpen(v: boolean) {
    this._tabSubmenuOpen = v;
    this.host.requestUpdate();
  }
}
