import {
  type ActionConfig,
  type HomeAssistant,
  type LovelaceCardConfig,
  hasAction,
} from 'custom-card-helpers';
import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import Sortable from 'sortablejs';

import { runAction } from './lib/action';
import { applyCardMod } from './lib/card-mod';
import {
  EDIT_EVENT,
  PREVIEW_REORDER_EVENT,
  PREVIEW_SELECT_EVENT,
  STORAGE_PREFIX,
  TOGGLE_EVENT,
} from './lib/const';
import {
  formatClock,
  formatCollapsedClock,
  formatCollapsedDate,
  formatDate,
  initials,
  zonedDate,
} from './lib/format';
import { TemplateManager } from './lib/templates';
import type {
  Align,
  CardBlock,
  CategoryBlock,
  ClockBlock,
  DashboardSidebarConfig,
  DateBlock,
  FooterButtonConfig,
  ItemBlock,
  MarkdownBlock,
  Region,
  SidebarBlock,
  TitleBlock,
} from './lib/types';
import { validateConfig } from './lib/validate';
import { sidebarStyles } from './styles';

/** Maps a config alignment to its flexbox `align-items` value. */
const FLEX_ALIGN: Record<Align, string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};

/** Style overrides that strip a markdown card's own chrome inside a block. */
const CHROMELESS_CARD = {
  '--ha-card-background': 'transparent',
  '--ha-card-box-shadow': 'none',
  '--ha-card-border-width': '0px',
};

/** The action-carrying fields read from an interactive element. */
interface ActionEl {
  /** Target entity for toggle/more-info actions. */
  entity?: string;
  /** Action fired on a single tap. */
  tap_action?: ActionConfig;
  /** Action fired on a long press. */
  hold_action?: ActionConfig;
  /** Action fired on a double tap. */
  double_tap_action?: ActionConfig;
}

/**
 * The dashboard sidebar element. Renders an ordered list of blocks in a fixed
 * header region and a scrolling body region, plus a footer of icon buttons or a
 * single card, in both the expanded and collapsed layouts. Invalid configs are
 * surfaced in an in-panel error list.
 */
@customElement('dashboard-sidebar')
export class DashboardSidebar extends LitElement {
  /** The current Home Assistant object, assigned by the bootstrap. */
  @property({ attribute: false }) public hass?: HomeAssistant;

  /** Whether the dashboard is in edit mode, which reveals the edit button. */
  @property({ attribute: false }) public editMode = false;

  /**
   * Whether this is an inert, chrome-less preview of a single block, embedded in
   * the editor. Suppresses the toggle/edit controls, the collapse state, and all
   * interaction, while keeping the real template, clock, card, and icon render.
   */
  @property({ type: Boolean, reflect: true }) public preview = false;

  /** In preview mode, whether to render the collapsed (icon-strip) look. */
  @property({ attribute: false }) public previewCollapsed = false;

  /**
   * In preview mode, the location string of the element currently selected in
   * the editor, so it can be outlined. Matches the `data-loc` stamped on each
   * rendered element (e.g. `body:1`, `body:1.0`, `footer:btn:0`, `footer:card`).
   */
  @property({ attribute: false }) public previewSelected?: string;

  /**
   * In preview mode, the location strings of categories to show collapsed
   * (e.g. `body:1`). Categories are expanded by default in a preview so their
   * items are selectable; the editor collapses specific ones on request.
   */
  @property({ attribute: false }) public previewCollapsedCats?: string[];

  /** The validated configuration, or undefined before setConfig runs. */
  @state() private _config?: DashboardSidebarConfig;

  /** Whether the sidebar is currently collapsed to its icon strip. */
  @state() private _collapsed = false;

  /** Clock tick; reassigned each interval so time blocks re-render. */
  @state() private _now = new Date();

  /** Key (`region-index`) of the collapsed category whose popover is open. */
  @state() private _openCategory: string | null = null;

  /** Viewport rect of the control anchoring an open popover, or null. */
  @state() private _popoverAnchor: DOMRect | null = null;

  /** Whether the footer overflow popover is open. */
  @state() private _footerOpen = false;

  /** The active hover tooltip for a collapsed row, or null. */
  @state() private _tooltip: { text: string; rect: DOMRect } | null = null;

  /** Keys (`region-index`) of categories currently collapsed when expanded. */
  @state() private _collapsedCats = new Set<string>();

  /** Config validation problems; non-empty switches render to the error panel. */
  @state() private _errors: string[] = [];

  /** Manager that subscribes to and caches templated field values. */
  private readonly _templates = new TemplateManager(() => this.requestUpdate());

  /** Handle of the clock/date interval timer, when running. */
  private _tick?: number;

  /** Built card elements for card blocks, keyed by `region-index` (or footer). */
  private _cards = new Map<string, HTMLElement & { hass?: HomeAssistant }>();

  /** Whether card-mod styles have already been applied for this config. */
  private _cardModApplied = false;

  /** Pending hold-gesture timer, and whether a hold has already fired. */
  private _holdTimer?: number;

  /** Set once a hold fires, so the following click does not also tap. */
  private _held = false;

  /** Pending single-tap timer while waiting to see if a double-tap follows. */
  private _tapTimer?: number;

  /** Stable render keys per block/item object, for keyed reconciliation. */
  private readonly _keys = new WeakMap<object, string>();

  /** Monotonic counter backing the render-key map. */
  private _keySeq = 0;

  /** Preview drag-and-drop containers already wired, to avoid re-wiring. */
  private readonly _sortables = new WeakSet<HTMLElement>();

  /** Pending close of the preview's hover popover, for hover-intent bridging. */
  private _previewPopoverTimer?: number;

  /**
   * Document-level click handler that closes any open popover when the click
   * lands outside this element.
   */
  private readonly _onDocumentClick = (ev: MouseEvent): void => {
    if ((this._openCategory !== null || this._footerOpen) && !ev.composedPath().includes(this)) {
      this._closePopovers();
    }
  };

  /**
   * Closes the category and footer popovers and clears the anchor.
   */
  private _closePopovers(): void {
    this._openCategory = null;
    this._footerOpen = false;
    this._popoverAnchor = null;
  }

  /**
   * Validates and stores the config, seeds the collapsed state and per-category
   * collapse set, collects templates, builds card blocks, and starts the clock.
   * Invalid configs are kept only as an error list for the panel.
   */
  public setConfig(config: DashboardSidebarConfig): void {
    // A preview renders a single region (e.g. a lone footer) best-effort, so it
    // skips the whole-sidebar validation that would otherwise gate rendering.
    this._errors = this.preview ? [] : validateConfig(config);
    this._config = config;
    this._cardModApplied = false;
    if (this._errors.length > 0) {
      console.warn(`[dashboard-sidebar] config errors:\n- ${this._errors.join('\n- ')}`);
      return;
    }
    this._collapsed = this.preview
      ? false
      : (this._readStored() ?? Boolean(config.start_collapsed));
    const cats = new Set<string>();
    // A preview shows every category expanded so all its items are visible and
    // selectable in the editor; live respects each category's start_collapsed.
    if (!this.preview) {
      this._eachBlock((block, region, i) => {
        if (block.type === 'category' && (block.start_collapsed ?? true)) {
          cats.add(`${region}-${i}`);
        }
      });
    }
    this._collapsedCats = cats;
    this._templates.collect(config);
    this._restartTick();
    void this._buildCards();
  }

  /**
   * Runs a callback for every header and body block, with its region and index.
   */
  private _eachBlock(fn: (block: SidebarBlock, region: Region, index: number) => void): void {
    (this._config?.header ?? []).forEach((block, i) => fn(block, 'header', i));
    (this._config?.body ?? []).forEach((block, i) => fn(block, 'body', i));
  }

  /**
   * Returns the leading-space-prefixed extra classes from a block's `class`
   * hook, for appending to a built-in class list.
   */
  private _hookClass(block: { class?: string }): string {
    return block.class ? ` ${block.class}` : '';
  }

  /**
   * Instantiates card elements for every card block (and a footer card) via
   * Home Assistant's card helpers, keyed by `region-index`.
   */
  private async _buildCards(): Promise<void> {
    const cfg = this._config;
    const specs: Array<[string, string | LovelaceCardConfig]> = [];
    this._eachBlock((block, region, i) => {
      if (block.type === 'card') {
        specs.push([`${region}-${i}`, block.card]);
      } else if (block.type === 'markdown') {
        specs.push([`${region}-${i}`, { type: 'markdown', content: block.content }]);
      }
    });
    if (cfg?.footer?.card !== undefined) {
      specs.push(['footer', cfg.footer.card]);
    } else if (cfg?.footer?.markdown !== undefined) {
      specs.push(['footer', { type: 'markdown', content: cfg.footer.markdown }]);
    }
    if (specs.length === 0) {
      this._cards = new Map();
      return;
    }
    const helpers = await (
      window as unknown as { loadCardHelpers?: () => Promise<any> }
    ).loadCardHelpers?.();
    if (!helpers) {
      return;
    }
    const map = new Map<string, HTMLElement & { hass?: HomeAssistant }>();
    specs.forEach(([key, card]) => {
      const cardConfig = typeof card === 'string' ? { type: 'markdown', content: card } : card;
      const el = helpers.createCardElement(cardConfig) as HTMLElement & { hass?: HomeAssistant };
      el.hass = this.hass;
      map.set(key, el);
    });
    this._cards = map;
    this.requestUpdate();
  }

  /**
   * Registers the outside-click listener and starts the clock when connected.
   */
  public connectedCallback(): void {
    super.connectedCallback();
    if (!this.preview) {
      window.addEventListener('click', this._onDocumentClick);
    }
    this._restartTick();
    // Re-subscribe templates on reconnect. A cached preview re-entering the DOM
    // (e.g. after an editor tab switch) had its subscriptions cleared on
    // disconnect, and setConfig is not called again when the config is
    // unchanged, so templated fields would otherwise render empty.
    if (this._config && this._errors.length === 0) {
      this._templates.collect(this._config);
    }
  }

  /**
   * Removes listeners, stops the clock, and unsubscribes templates on removal.
   */
  public disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('click', this._onDocumentClick);
    this._stopTick();
    this._cancelPopoverClose();
    this._templates.clear();
  }

  /**
   * Reacts to reactive-property changes: fires the collapse toggle event first
   * so the wrapper resizes, forwards hass to templates and cards, then applies
   * card-mod.
   */
  protected updated(changed: PropertyValues): void {
    if (changed.has('_collapsed')) {
      this.dispatchEvent(
        new CustomEvent(TOGGLE_EVENT, {
          detail: { collapsed: this._collapsed, side: this._side },
          bubbles: true,
          composed: true,
        }),
      );
    }
    if (changed.has('hass')) {
      this._templates.setHass(this.hass);
      this._cards.forEach((el) => {
        el.hass = this.hass;
      });
    }
    this._applyCardMod();
    this._wirePreviewSort();
  }

  /**
   * In an expanded preview, wires drag-and-drop onto the region container, each
   * category's item list, and the footer button bar. No-op in live mode or a
   * collapsed preview.
   */
  private _wirePreviewSort(): void {
    if (!this.preview || this.previewCollapsed) {
      return;
    }
    const root = this.renderRoot as ParentNode;
    (['header', 'body'] as const).forEach((region) => {
      const container = root.querySelector<HTMLElement>(`.region-${region}`);
      if (container) {
        this._wireSort(container, region);
      }
      root
        .querySelectorAll<HTMLElement>(`.region-${region} .category-items`)
        .forEach((el) => this._wireSort(el, region));
    });
    const footer = root.querySelector<HTMLElement>('.footer[data-container="footer"]');
    if (footer) {
      this._wireSort(footer, 'footer');
    }
  }

  /**
   * Applies the configured card-mod styles once per config, when the card-mod
   * integration is installed. Retries on later updates until it succeeds.
   */
  private _applyCardMod(): void {
    const cfg = this._config?.card_mod;
    if (!cfg || this._cardModApplied || this._errors.length > 0) {
      return;
    }
    this._cardModApplied = applyCardMod(this, cfg);
  }

  /**
   * The resolved dock side, from the config position (default left).
   */
  private get _side(): 'left' | 'right' {
    return this._config?.position === 'right' ? 'right' : 'left';
  }

  /**
   * The active locale, from hass or the browser, used for date/time names.
   */
  private get _locale(): string {
    return this.hass?.locale?.language ?? navigator.language;
  }

  /**
   * The localStorage key for this view and dock side's collapsed state.
   */
  private _storageKey(): string {
    return `${STORAGE_PREFIX}:${window.location.pathname}:${this._side}`;
  }

  /**
   * Reads the stored collapsed state, or null when unset or unavailable.
   */
  private _readStored(): boolean | null {
    try {
      const raw = window.localStorage.getItem(this._storageKey());
      return raw === null ? null : raw === '1';
    } catch {
      return null;
    }
  }

  /**
   * Whether the config contains any clock and/or date blocks.
   */
  private _timeKinds(): { clock: boolean; date: boolean } {
    let clock = false;
    let date = false;
    this._eachBlock((block) => {
      if (block.type === 'clock') {
        clock = true;
      }
      if (block.type === 'date') {
        date = true;
      }
    });
    return { clock, date };
  }

  /**
   * Restarts the clock/date timer: every second when a clock is shown, every
   * minute for date-only, and not at all when neither is present.
   */
  private _restartTick(): void {
    this._stopTick();
    const { clock, date } = this._timeKinds();
    if (!clock && !date) {
      return;
    }
    const interval = clock ? 1000 : 60000;
    this._tick = window.setInterval(() => {
      this._now = new Date();
    }, interval);
  }

  /**
   * Stops the clock/date timer if it is running.
   */
  private _stopTick(): void {
    if (this._tick !== undefined) {
      window.clearInterval(this._tick);
      this._tick = undefined;
    }
  }

  /**
   * Fires the edit event so the bootstrap opens the editor.
   */
  private _openEditor(): void {
    this.dispatchEvent(new CustomEvent(EDIT_EVENT, { bubbles: true, composed: true }));
  }

  /**
   * Toggles the collapsed state, closes popovers, and persists the choice.
   */
  private _toggleCollapse(): void {
    this._collapsed = !this._collapsed;
    this._tooltip = null;
    this._closePopovers();
    try {
      window.localStorage.setItem(this._storageKey(), this._collapsed ? '1' : '0');
    } catch {
      // localStorage unavailable; the toggle still works for the session
    }
  }

  /**
   * Fires the tap/hold/double-tap action through Home Assistant. No-ops in a
   * preview (where a click selects the element for editing instead).
   */
  private _fireAction(cfg: ActionEl, gesture: 'tap' | 'hold' | 'double_tap'): void {
    if (this.preview || !this.hass) {
      return;
    }
    const action =
      gesture === 'hold'
        ? cfg.hold_action
        : gesture === 'double_tap'
          ? cfg.double_tap_action
          : cfg.tap_action;
    runAction(this, this.hass, action, cfg.entity);
    this._closePopovers();
  }

  /**
   * Starts the hold timer on press, so a long press fires the hold action.
   */
  private _onActionDown(cfg: ActionEl): void {
    if (this.preview) {
      return;
    }
    this._held = false;
    window.clearTimeout(this._holdTimer);
    if (hasAction(cfg.hold_action)) {
      this._holdTimer = window.setTimeout(() => {
        this._held = true;
        this._fireAction(cfg, 'hold');
      }, 500);
    }
  }

  /** Cancels a pending hold when the press ends or is interrupted. */
  private readonly _cancelHold = (): void => {
    window.clearTimeout(this._holdTimer);
  };

  /**
   * On click, fires tap — or defers to distinguish a double-tap when one is
   * configured — unless a hold already fired.
   */
  private _onActionClick(cfg: ActionEl): void {
    if (this.preview) {
      return;
    }
    window.clearTimeout(this._holdTimer);
    if (this._held) {
      this._held = false;
      return;
    }
    if (!hasAction(cfg.double_tap_action)) {
      this._fireAction(cfg, 'tap');
      return;
    }
    if (this._tapTimer) {
      window.clearTimeout(this._tapTimer);
      this._tapTimer = undefined;
      this._fireAction(cfg, 'double_tap');
    } else {
      this._tapTimer = window.setTimeout(() => {
        this._tapTimer = undefined;
        this._fireAction(cfg, 'tap');
      }, 250);
    }
  }

  /**
   * Whether a block has any tap/hold/double-tap action that does something.
   */
  private _actionable(block: ActionEl): boolean {
    return (
      hasAction(block.tap_action) ||
      hasAction(block.hold_action) ||
      hasAction(block.double_tap_action)
    );
  }

  /**
   * Toggles the footer overflow popover, anchoring it to the clicked control.
   */
  private _toggleFooter(ev: Event): void {
    if (this._footerOpen) {
      this._closePopovers();
      return;
    }
    this._openCategory = null;
    this._footerOpen = true;
    this._tooltip = null;
    this._popoverAnchor = (ev.currentTarget as HTMLElement).getBoundingClientRect();
  }

  /**
   * Computes fixed-position coordinates for a popover beside its anchor, on the
   * side away from the dock edge and growing up or down as requested.
   */
  private _popoverStyle(anchor: DOMRect, growUp: boolean): Record<string, string> {
    const style: Record<string, string> = {};
    if (this._side === 'left') {
      style.left = `${anchor.right + 8}px`;
    } else {
      style.right = `${window.innerWidth - anchor.left + 8}px`;
    }
    if (growUp) {
      style.bottom = `${window.innerHeight - anchor.bottom}px`;
    } else {
      style.top = `${anchor.top}px`;
    }
    return style;
  }

  /**
   * Shows the hover tooltip for an icon-only control, anchored to it. HA tends
   * to suppress native title tooltips, so this provides a reliable one. Only
   * controls that attach the handler (collapsed rows and footer buttons) use
   * it; labelled expanded rows do not.
   */
  private _showTip(ev: MouseEvent, text: string): void {
    if (!text) {
      return;
    }
    this._tooltip = { text, rect: (ev.currentTarget as HTMLElement).getBoundingClientRect() };
  }

  /**
   * Hides the hover tooltip.
   */
  private _hideTip(): void {
    if (this._tooltip) {
      this._tooltip = null;
    }
  }

  /**
   * Computes fixed-position coordinates for the tooltip beside its row, on the
   * side away from the dock edge and vertically centered.
   */
  private _tipStyle(rect: DOMRect): Record<string, string> {
    const style: Record<string, string> = { top: `${rect.top + rect.height / 2}px` };
    if (this._side === 'left') {
      style.left = `${rect.right + 8}px`;
    } else {
      style.right = `${window.innerWidth - rect.left + 8}px`;
    }
    return style;
  }

  /**
   * Opens a collapsed category's popover on hover (preview only), anchoring it
   * to the row and cancelling any pending close so moving onto the popover keeps
   * it open.
   */
  private _hoverCategory(key: string, ev: Event): void {
    this._cancelPopoverClose();
    this._footerOpen = false;
    this._tooltip = null;
    this._openCategory = key;
    this._popoverAnchor = (ev.currentTarget as HTMLElement).getBoundingClientRect();
  }

  /**
   * Cancels a pending hover-popover close.
   */
  private _cancelPopoverClose(): void {
    if (this._previewPopoverTimer !== undefined) {
      window.clearTimeout(this._previewPopoverTimer);
      this._previewPopoverTimer = undefined;
    }
  }

  /**
   * Schedules the hover popover to close shortly, bridging the gap between the
   * category icon and its popover so it does not flicker shut while crossing.
   */
  private _schedulePopoverClose(): void {
    this._cancelPopoverClose();
    this._previewPopoverTimer = window.setTimeout(() => {
      this._closePopovers();
      this._previewPopoverTimer = undefined;
    }, 140);
  }

  /**
   * Toggles the popover for a collapsed category, anchoring it to the row.
   */
  private _toggleCategory(key: string, ev: Event): void {
    if (this._openCategory === key) {
      this._openCategory = null;
      this._popoverAnchor = null;
      return;
    }
    this._footerOpen = false;
    this._openCategory = key;
    this._tooltip = null;
    this._popoverAnchor = (ev.currentTarget as HTMLElement).getBoundingClientRect();
  }

  /**
   * A stable render key for a block or item object, minted on first use, so
   * keyed `repeat` reconciles cleanly after a preview drag moves DOM nodes.
   */
  private _keyFor(obj: object): string {
    let key = this._keys.get(obj);
    if (!key) {
      this._keySeq += 1;
      key = `k${this._keySeq}`;
      this._keys.set(obj, key);
    }
    return key;
  }

  /**
   * The extra class marking the selected element in preview mode, keyed off the
   * element's location string.
   */
  private _selClass(loc: string): string {
    return this.preview && this.previewSelected === loc ? ' sb-selected' : '';
  }

  /**
   * In preview mode, a click anywhere on an element selects it for editing
   * (dispatched to the editor) rather than running its action.
   */
  private _onPreviewClick(ev: Event): void {
    const target = ev.target as Element | null;
    const el = target?.closest?.('[data-loc]');
    if (!el) {
      return;
    }
    ev.stopPropagation();
    this.dispatchEvent(
      new CustomEvent(PREVIEW_SELECT_EVENT, {
        detail: { loc: el.getAttribute('data-loc') },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Wires drag-and-drop reordering onto a preview container, dispatching the
   * source/destination containers and indices so the editor can rebuild the
   * config. Category item lists accept only items; the whole element is the
   * drag handle, so no separate handle is shown.
   */
  private _wireSort(el: HTMLElement, region: Region | 'footer'): void {
    if (this._sortables.has(el)) {
      return;
    }
    this._sortables.add(el);
    const itemsOnly =
      el.classList.contains('region-body') || el.classList.contains('region-header')
        ? false
        : el.classList.contains('category-items');
    Sortable.create(el, {
      group: {
        name: `sb-${region}`,
        put: itemsOnly
          ? (_to, _from, drag) => drag.classList.contains('dashboard-sidebar-item')
          : true,
      },
      animation: 150,
      onEnd: (evt) => {
        this.dispatchEvent(
          new CustomEvent(PREVIEW_REORDER_EVENT, {
            detail: {
              from: evt.from.getAttribute('data-container'),
              to: evt.to.getAttribute('data-container'),
              oldIndex: evt.oldIndex,
              newIndex: evt.newIndex,
            },
            bubbles: true,
            composed: true,
          }),
        );
      },
    });
  }

  /**
   * Toggles whether a category is collapsed within the expanded menu. In a
   * preview all categories stay expanded, so the header click only selects.
   */
  private _toggleCategoryCollapse(key: string): void {
    if (this.preview) {
      return;
    }
    const next = new Set(this._collapsedCats);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this._collapsedCats = next;
  }

  /**
   * Renders the sidebar, or the error panel when the config is invalid.
   */
  protected render(): TemplateResult {
    if (this._errors.length > 0) {
      return this._renderErrors();
    }
    if (!this._config) {
      return html``;
    }
    const collapsed = this.preview ? this.previewCollapsed : this._collapsed;
    const cfg = this._config;
    const classes = {
      sidebar: true,
      'dashboard-sidebar-root': true,
      collapsed,
      preview: this.preview,
      [`pos-${this._side}`]: true,
    };
    const sidebarStyle = cfg.background ? { background: cfg.background } : {};

    return html`
      <div
        class=${classMap(classes)}
        style=${styleMap(sidebarStyle)}
        @click=${this.preview ? (ev: Event) => this._onPreviewClick(ev) : nothing}
      >
        ${
          this.preview
            ? nothing
            : html`<button
                  class="toggle dashboard-sidebar-toggle"
                  title=${collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  @click=${this._toggleCollapse}
                >
                  <ha-icon icon="mdi:chevron-left"></ha-icon>
                </button>
                ${
                  this.editMode
                    ? html`<button
                        class="edit-btn dashboard-sidebar-edit"
                        title="Edit sidebar"
                        @click=${this._openEditor}
                      >
                        <ha-icon icon="mdi:pencil"></ha-icon>
                      </button>`
                    : nothing
                }`
        }
        ${this._renderRegion('header', cfg.header, collapsed, 'region-header dashboard-sidebar-header')}
        ${this._renderRegion('body', cfg.body, collapsed, 'region-body dashboard-sidebar-body')}
        ${this._renderFooter(collapsed)} ${this._renderTooltip()}
      </div>
    `;
  }

  /**
   * Renders the hover tooltip for a collapsed row, fixed to the viewport.
   */
  private _renderTooltip(): TemplateResult | typeof nothing {
    if (!this._tooltip) {
      return nothing;
    }
    return html`<div
      class="tooltip dashboard-sidebar-tooltip"
      style=${styleMap(this._tipStyle(this._tooltip.rect))}
    >
      ${this._tooltip.text}
    </div>`;
  }

  /**
   * Renders one block region as a column, or nothing when it has no blocks.
   */
  private _renderRegion(
    region: Region,
    blocks: SidebarBlock[] | undefined,
    collapsed: boolean,
    cls: string,
  ): TemplateResult | typeof nothing {
    if (!blocks?.length) {
      return nothing;
    }
    return html`
      <div class="region ${cls}" data-container=${region}>
        ${repeat(
          blocks,
          (block) => this._keyFor(block),
          (block, i) => this._renderBlock(block, region, i, collapsed),
        )}
      </div>
    `;
  }

  /**
   * Renders one block, dispatching on its type. `loc` is the block's location
   * string (`region:index`), stamped for preview selection.
   */
  private _renderBlock(
    block: SidebarBlock,
    region: Region,
    index: number,
    collapsed: boolean,
  ): TemplateResult | typeof nothing {
    const loc = `${region}:${index}`;
    switch (block.type) {
      case 'title':
        return this._renderTitle(block, collapsed, loc);
      case 'clock':
        return this._renderClock(block, collapsed, loc);
      case 'date':
        return this._renderDate(block, collapsed, loc);
      case 'divider':
        return html`<div
          class="entry-divider dashboard-sidebar-divider${this._hookClass(block)}${this._selClass(loc)}"
          id=${block.id ?? nothing}
          data-loc=${loc}
        ></div>`;
      case 'item':
        return this._renderItemRow(block, collapsed, loc);
      case 'category':
        return this._renderCategory(block, region, index, collapsed);
      case 'markdown':
        return this._renderMarkdown(block, `${region}-${index}`, collapsed, loc);
      case 'card':
        return this._renderCardBlock(block, `${region}-${index}`, collapsed, loc);
      default:
        return nothing;
    }
  }

  /**
   * Renders a title block, hidden while collapsed.
   */
  private _renderTitle(
    block: TitleBlock,
    collapsed: boolean,
    loc: string,
  ): TemplateResult | typeof nothing {
    if (collapsed) {
      return nothing;
    }
    const text = this._templates.resolve(block.text);
    const style = { 'text-align': block.align ?? 'center' };
    const clickable = this._actionable(block) ? ' clickable' : '';
    return html`<div
      class="app-title dashboard-sidebar-title${clickable}${this._hookClass(block)}${this._selClass(loc)}"
      id=${block.id ?? nothing}
      data-loc=${loc}
      style=${styleMap(style)}
      @pointerdown=${() => this._onActionDown(block)}
      @pointerup=${this._cancelHold}
      @pointercancel=${this._cancelHold}
      @click=${() => this._onActionClick(block)}
    >
      ${text}
    </div>`;
  }

  /**
   * Renders a clock block, using the compact form while collapsed.
   */
  private _renderClock(block: ClockBlock, collapsed: boolean, loc: string): TemplateResult {
    const style = { 'text-align': block.align ?? 'center' };
    // `format` is an strftime pattern for the time. Legacy configs may still hold
    // the `12h`/`24h` convention plus the old `show_seconds`/`hour_format`/
    // `collapsed_format` keys; fold those into a pattern here.
    const legacy = block as ClockBlock & {
      hour_format?: string;
      collapsed_format?: string;
      show_seconds?: boolean;
    };
    const raw = typeof legacy.format === 'string' ? legacy.format.trim() : '';
    let pattern: string;
    let twelve: boolean;
    if (raw !== '' && raw !== '12h' && raw !== '24h') {
      pattern = raw;
      twelve = /%-?[Il]|%p|%P/.test(raw);
    } else {
      const hour =
        raw === '12h' || raw === '24h'
          ? raw
          : (legacy.hour_format ?? legacy.collapsed_format ?? '24h');
      twelve = hour === '12h';
      const seconds = legacy.show_seconds ?? false;
      pattern = twelve ? (seconds ? '%-I:%M:%S %p' : '%-I:%M %p') : seconds ? '%H:%M:%S' : '%H:%M';
    }
    const now = zonedDate(this._now, block.timezone ?? '');
    const clickable = this._actionable(block) ? ' clickable' : '';
    return html`<div
      class="clock dashboard-sidebar-clock${clickable}${this._hookClass(block)}${this._selClass(loc)}"
      id=${block.id ?? nothing}
      data-loc=${loc}
      style=${styleMap(style)}
      @pointerdown=${() => this._onActionDown(block)}
      @pointerup=${this._cancelHold}
      @pointercancel=${this._cancelHold}
      @click=${() => this._onActionClick(block)}
    >
      ${collapsed ? formatCollapsedClock(now, twelve) : formatClock(now, pattern, this._locale)}
    </div>`;
  }

  /**
   * Renders a date block, using the compact form while collapsed.
   */
  private _renderDate(block: DateBlock, collapsed: boolean, loc: string): TemplateResult {
    const style = { 'text-align': block.align ?? 'center' };
    const bf = typeof block.format === 'string' ? block.format : '';
    const format = bf.trim() || 'locale';
    const now = zonedDate(this._now, block.timezone ?? '');
    const clickable = this._actionable(block) ? ' clickable' : '';
    return html`<div
      class="date dashboard-sidebar-date${clickable}${this._hookClass(block)}${this._selClass(loc)}"
      id=${block.id ?? nothing}
      data-loc=${loc}
      style=${styleMap(style)}
      @pointerdown=${() => this._onActionDown(block)}
      @pointerup=${this._cancelHold}
      @pointercancel=${this._cancelHold}
      @click=${() => this._onActionClick(block)}
    >
      ${collapsed ? formatCollapsedDate(now) : formatDate(now, format, this._locale)}
    </div>`;
  }

  /**
   * Renders a markdown block, hidden while collapsed. The markdown card is shown
   * chrome-less so it does not draw its own box inside the block.
   */
  private _renderMarkdown(
    block: MarkdownBlock,
    key: string,
    collapsed: boolean,
    loc: string,
  ): TemplateResult | typeof nothing {
    if (collapsed) {
      return nothing;
    }
    const el = this._cards.get(key);
    if (!el) {
      return nothing;
    }
    const align = block.align ?? 'left';
    const style = {
      'align-items': FLEX_ALIGN[align],
      'text-align': align,
      ...CHROMELESS_CARD,
    };
    return html`<div
      class="content dashboard-sidebar-markdown${this._hookClass(block)}${this._selClass(loc)}"
      id=${block.id ?? nothing}
      data-loc=${loc}
      style=${styleMap(style)}
    >
      ${el}
    </div>`;
  }

  /**
   * Renders a manual card block wrapper, hidden while collapsed. A legacy string
   * card is shown chrome-less for back-compat; an object card keeps its chrome.
   */
  private _renderCardBlock(
    block: CardBlock,
    key: string,
    collapsed: boolean,
    loc: string,
  ): TemplateResult | typeof nothing {
    if (collapsed) {
      return nothing;
    }
    const el = this._cards.get(key);
    if (!el) {
      return nothing;
    }
    const align = block.align ?? 'left';
    const style = {
      'align-items': FLEX_ALIGN[align],
      'text-align': align,
      ...(typeof block.card === 'string' ? CHROMELESS_CARD : {}),
      ...(block.background
        ? { background: block.background, padding: '8px', 'border-radius': '8px' }
        : {}),
    };
    return html`<div
      class="content dashboard-sidebar-content${this._hookClass(block)}${this._selClass(loc)}"
      id=${block.id ?? nothing}
      data-loc=${loc}
      style=${styleMap(style)}
    >
      ${el}
    </div>`;
  }

  /**
   * Renders a category as an expanded group or a collapsed icon button.
   */
  private _renderCategory(
    category: CategoryBlock,
    region: Region,
    index: number,
    collapsed: boolean,
  ): TemplateResult {
    const key = `${region}-${index}`;
    const loc = `${region}:${index}`;
    return collapsed
      ? this._renderCollapsedCategory(category, key, loc)
      : this._renderExpandedCategory(category, key, loc);
  }

  /**
   * Renders a single item row: an icon-only button when collapsed (falling back
   * to initials), or an icon-and-label row when expanded.
   */
  private _renderItemRow(item: ItemBlock, collapsed: boolean, loc: string): TemplateResult {
    const title = this._templates.resolve(item.title);
    const icon = item.icon ? this._templates.resolve(item.icon) : '';
    const textColor = item.text_color ? this._templates.resolve(item.text_color) : '';
    const iconColor = item.icon_color ? this._templates.resolve(item.icon_color) : '';

    if (collapsed) {
      return html`
        <button
          class="row item collapsed-row dashboard-sidebar-item${this._hookClass(item)}${this._selClass(loc)}"
          id=${item.id ?? nothing}
          data-loc=${loc}
          aria-label=${title}
          @mouseenter=${(ev: MouseEvent) => this._showTip(ev, title)}
          @mouseleave=${this._hideTip}
          @pointerdown=${() => this._onActionDown(item)}
          @pointerup=${this._cancelHold}
          @pointercancel=${this._cancelHold}
          @click=${() => this._onActionClick(item)}
        >
          ${
            icon
              ? html`<ha-icon
                  class="dashboard-sidebar-item-icon"
                  icon=${icon}
                  style=${styleMap({ color: iconColor })}
                ></ha-icon>`
              : html`<span class="initials dashboard-sidebar-initials"
                  >${item.abbr ?? initials(title)}</span
                >`
          }
        </button>
      `;
    }

    return html`
      <button
        class="row item dashboard-sidebar-item${this._hookClass(item)}${this._selClass(loc)}"
        id=${item.id ?? nothing}
        data-loc=${loc}
        @pointerdown=${() => this._onActionDown(item)}
        @pointerup=${this._cancelHold}
        @pointercancel=${this._cancelHold}
        @click=${() => this._onActionClick(item)}
      >
        ${
          icon
            ? html`<ha-icon
                class="dashboard-sidebar-item-icon"
                icon=${icon}
                style=${styleMap({ color: iconColor })}
              ></ha-icon>`
            : nothing
        }
        <span class="label dashboard-sidebar-item-label" style=${styleMap({ color: textColor })}
          >${title}</span
        >
      </button>
    `;
  }

  /**
   * Renders an expanded category: a clickable header with a chevron, and its
   * items behind an optional guide line when open.
   */
  private _renderExpandedCategory(
    category: CategoryBlock,
    key: string,
    loc: string,
  ): TemplateResult {
    const title = this._templates.resolve(category.title);
    const icon = category.icon ? this._templates.resolve(category.icon) : '';
    // In a preview, categories are expanded unless the editor asks otherwise.
    const collapsed = this.preview
      ? (this.previewCollapsedCats?.includes(loc) ?? false)
      : this._collapsedCats.has(key);
    return html`
      <div
        class="category dashboard-sidebar-category${this._hookClass(category)}"
        id=${category.id ?? nothing}
      >
        <button
          class="row category-header dashboard-sidebar-category-header${this._selClass(loc)}"
          data-loc=${loc}
          @click=${() => this._toggleCategoryCollapse(key)}
        >
          ${icon ? html`<ha-icon icon=${icon}></ha-icon>` : nothing}
          <span class="label">${title}</span>
          <ha-icon
            class="chevron dashboard-sidebar-chevron ${collapsed ? '' : 'open'}"
            icon="mdi:chevron-down"
          ></ha-icon>
        </button>
        ${
          collapsed
            ? nothing
            : html`<div
                class="category-items dashboard-sidebar-category-items ${
                  category.guide_line === false ? 'no-line' : ''
                }"
                data-container=${loc}
              >
                ${repeat(
                  category.items,
                  (item) => this._keyFor(item),
                  (item, j) => this._renderItemRow(item, false, `${loc}.${j}`),
                )}
              </div>`
        }
      </div>
    `;
  }

  /**
   * Renders a collapsed category as an icon button that opens an item popover.
   */
  private _renderCollapsedCategory(
    category: CategoryBlock,
    key: string,
    loc: string,
  ): TemplateResult {
    const title = this._templates.resolve(category.title);
    const icon = category.icon ? this._templates.resolve(category.icon) : '';
    const open = this._openCategory === key;
    return html`
      <div
        class="category-anchor dashboard-sidebar-category${this._hookClass(category)}"
        id=${category.id ?? nothing}
      >
        <button
          class="row item collapsed-row dashboard-sidebar-item ${open ? 'active' : ''}${this._selClass(loc)}"
          data-loc=${loc}
          aria-label=${title}
          @mouseenter=${
            this.preview
              ? (ev: MouseEvent) => this._hoverCategory(key, ev)
              : (ev: MouseEvent) => {
                  if (!open) {
                    this._showTip(ev, title);
                  }
                }
          }
          @mouseleave=${this.preview ? () => this._schedulePopoverClose() : this._hideTip}
          @click=${
            this.preview
              ? nothing
              : (ev: Event) => {
                  ev.stopPropagation();
                  this._toggleCategory(key, ev);
                }
          }
        >
          ${
            icon
              ? html`<ha-icon class="dashboard-sidebar-item-icon" icon=${icon}></ha-icon>`
              : html`<span class="initials dashboard-sidebar-initials"
                  >${category.abbr ?? initials(title)}</span
                >`
          }
        </button>
        ${
          open && this._popoverAnchor
            ? this._renderPopover(category, this._popoverAnchor, loc)
            : nothing
        }
      </div>
    `;
  }

  /**
   * Renders a collapsed category's popover: its title and item rows, fixed to
   * the viewport so it escapes the scrollable body's clipping.
   */
  private _renderPopover(category: CategoryBlock, anchor: DOMRect, loc: string): TemplateResult {
    return html`
      <div
        class="popover dashboard-sidebar-popover"
        style=${styleMap(this._popoverStyle(anchor, false))}
        @click=${this.preview ? nothing : (ev: Event) => ev.stopPropagation()}
        @mouseenter=${this.preview ? () => this._cancelPopoverClose() : nothing}
        @mouseleave=${this.preview ? () => this._schedulePopoverClose() : nothing}
      >
        <div class="popover-title dashboard-sidebar-popover-title">
          ${this._templates.resolve(category.title)}
        </div>
        ${category.items.map((item, j) => this._renderItemRow(item, false, `${loc}.${j}`))}
      </div>
    `;
  }

  /**
   * Renders the footer: a single card, or the icon-button bar with overflow.
   * A card footer shows no dots menu and is hidden while collapsed.
   */
  private _renderFooter(collapsed: boolean): TemplateResult | typeof nothing {
    const footer = this._config?.footer;
    if (!footer) {
      return nothing;
    }
    const footerClasses = {
      footer: true,
      'dashboard-sidebar-footer': true,
      'collapsed-footer': collapsed,
      'no-divider': footer.divider === false,
    };

    if (footer.card !== undefined || footer.markdown !== undefined) {
      const el = collapsed ? undefined : this._cards.get('footer');
      if (!el) {
        return nothing;
      }
      const markdown = footer.markdown !== undefined;
      const style = markdown || typeof footer.card === 'string' ? CHROMELESS_CARD : {};
      const loc = markdown ? 'footer:markdown' : 'footer:card';
      return html`<div class=${classMap(footerClasses)}>
        <div
          class="content dashboard-sidebar-content${this._selClass(loc)}"
          data-loc=${loc}
          style=${styleMap(style)}
        >
          ${el}
        </div>
      </div>`;
    }

    const buttons = footer.buttons ?? [];
    if (buttons.length === 0) {
      return nothing;
    }
    const anchor = this._popoverAnchor;

    if (collapsed) {
      return html`
        <div class=${classMap(footerClasses)}>
          ${this._renderDots('row item collapsed-row dashboard-sidebar-item dashboard-sidebar-footer-more')}
          ${this._footerOpen && anchor ? this._renderFooterPopover(buttons, anchor, 0) : nothing}
        </div>
      `;
    }

    // A preview shows every button inline so each is visible and reorderable;
    // live fits as many as the width allows and overflows the rest to a menu.
    if (this.preview) {
      return html`<div class=${classMap(footerClasses)} data-container="footer">
        ${repeat(
          buttons,
          (btn) => this._keyFor(btn),
          (btn, i) => this._renderFooterButton(btn, i),
        )}
      </div>`;
    }

    const width = this._config?.width ?? 240;
    const maxFit = Math.max(1, Math.floor((width - 24 + 4) / 44)); // 40px button + 4px gap
    if (buttons.length <= maxFit) {
      return html`<div class=${classMap(footerClasses)}>
        ${buttons.map((btn, i) => this._renderFooterButton(btn, i))}
      </div>`;
    }
    const inline = buttons.slice(0, maxFit - 1);
    const overflow = buttons.slice(maxFit - 1);
    return html`
      <div class=${classMap(footerClasses)}>
        ${inline.map((btn, i) => this._renderFooterButton(btn, i))}
        ${this._renderDots('footer-btn dashboard-sidebar-footer-btn dashboard-sidebar-footer-more')}
        ${this._footerOpen && anchor ? this._renderFooterPopover(overflow, anchor, maxFit - 1) : nothing}
      </div>
    `;
  }

  /**
   * Renders the overflow "dots" button that opens the footer popover.
   */
  private _renderDots(cls: string): TemplateResult {
    return html`
      <button
        class="${cls} ${this._footerOpen ? 'active' : ''}"
        aria-label="More"
        @mouseenter=${(ev: MouseEvent) => {
          if (!this._footerOpen) {
            this._showTip(ev, 'More');
          }
        }}
        @mouseleave=${this._hideTip}
        @click=${(ev: Event) => {
          ev.stopPropagation();
          this._toggleFooter(ev);
        }}
      >
        <ha-icon icon="mdi:dots-vertical"></ha-icon>
      </button>
    `;
  }

  /**
   * Renders the footer overflow popover holding the given buttons, fixed to the
   * viewport and growing upward from its anchor.
   */
  private _renderFooterPopover(
    buttons: FooterButtonConfig[],
    anchor: DOMRect,
    startIndex: number,
  ): TemplateResult {
    return html`
      <div
        class="popover footer-popover dashboard-sidebar-popover dashboard-sidebar-footer-popover"
        style=${styleMap(this._popoverStyle(anchor, true))}
        @click=${(ev: Event) => ev.stopPropagation()}
      >
        ${buttons.map((btn, i) => this._renderFooterButton(btn, startIndex + i))}
      </div>
    `;
  }

  /**
   * Renders a single footer icon button that runs its configured action.
   */
  private _renderFooterButton(btn: FooterButtonConfig, index: number): TemplateResult {
    const icon = this._templates.resolve(btn.icon);
    const color = btn.icon_color ? this._templates.resolve(btn.icon_color) : '';
    const title = btn.title ? this._templates.resolve(btn.title) : '';
    const loc = `footer:btn:${index}`;
    return html`
      <button
        class="footer-btn dashboard-sidebar-footer-btn${this._hookClass(btn)}${this._selClass(loc)}"
        id=${btn.id ?? nothing}
        data-loc=${loc}
        aria-label=${title}
        @mouseenter=${(ev: MouseEvent) => this._showTip(ev, title)}
        @mouseleave=${this._hideTip}
        @pointerdown=${() => this._onActionDown(btn)}
        @pointerup=${this._cancelHold}
        @pointercancel=${this._cancelHold}
        @click=${() => this._onActionClick(btn)}
      >
        <ha-icon
          class="dashboard-sidebar-footer-icon"
          icon=${icon}
          style=${styleMap({ color })}
        ></ha-icon>
      </button>
    `;
  }

  /**
   * Renders the config-error panel listing every validation problem.
   */
  private _renderErrors(): TemplateResult {
    return html`
      <div class="config-error">
        <div class="config-error-title">
          <ha-icon icon="mdi:alert-circle"></ha-icon>
          <span>dashboard_sidebar config</span>
        </div>
        <ul>
          ${this._errors.map((err) => html`<li>${err}</li>`)}
        </ul>
      </div>
    `;
  }

  /** The composed set of stylesheets for the element. */
  static styles = sidebarStyles;
}

declare global {
  /** Registers the element's tag name for typed DOM lookups. */
  interface HTMLElementTagNameMap {
    /** The dashboard sidebar custom element. */
    'dashboard-sidebar': DashboardSidebar;
  }
}
