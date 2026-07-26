import { type HomeAssistant, type LovelaceCardConfig, handleAction } from 'custom-card-helpers';
import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import { applyCardMod } from './lib/card-mod';
import { CONFIG_CHANGED_EVENT, STORAGE_PREFIX, TOGGLE_EVENT } from './lib/const';
import {
  formatClock,
  formatCollapsedClock,
  formatCollapsedDate,
  formatDate,
  initials,
} from './lib/format';
import { TemplateManager } from './lib/templates';
import type {
  Align,
  BlockType,
  CardBlock,
  CategoryBlock,
  ClockBlock,
  DashboardSidebarConfig,
  DateBlock,
  FooterButtonConfig,
  ItemBlock,
  Region,
  SidebarBlock,
  TitleBlock,
} from './lib/types';
import { validateConfig } from './lib/validate';
import { defaultBlock, defaultFooterButton } from './editor/arrange';
import { sidebarStyles } from './styles';

/** Every block type, offered when adding to the header. */
const ADD_TYPES: BlockType[] = ['title', 'clock', 'date', 'divider', 'item', 'category', 'card'];

/** What the settings modal is currently editing, or null when closed. */
type EditTarget =
  | { kind: 'block'; region: Region; index: number }
  | { kind: 'item'; region: Region; index: number; itemIndex: number }
  | { kind: 'footer'; index: number }
  | { kind: 'footer-card' };

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

  /** What the in-place settings modal is editing, or null when closed. */
  @state() private _editing: EditTarget | null = null;

  /** Stable ids per block object, for keyed edit rendering and drag-and-drop. */
  private readonly _blockIds = new WeakMap<object, string>();

  /** Monotonic counter backing the block id map. */
  private _idSeq = 0;

  /** Manager that subscribes to and caches templated field values. */
  private readonly _templates = new TemplateManager(() => this.requestUpdate());

  /** Handle of the clock/date interval timer, when running. */
  private _tick?: number;

  /** Built card elements for card blocks, keyed by `region-index` (or footer). */
  private _cards = new Map<string, HTMLElement & { hass?: HomeAssistant }>();

  /** Whether card-mod styles have already been applied for this config. */
  private _cardModApplied = false;

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
    this._errors = validateConfig(config);
    this._config = config;
    this._cardModApplied = false;
    if (this._errors.length > 0) {
      console.warn(`[dashboard-sidebar] config errors:\n- ${this._errors.join('\n- ')}`);
      return;
    }
    this._collapsed = this._readStored() ?? Boolean(config.start_collapsed);
    const cats = new Set<string>();
    this._eachBlock((block, region, i) => {
      if (block.type === 'category' && (block.start_collapsed ?? true)) {
        cats.add(`${region}-${i}`);
      }
    });
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
   * Returns a stable id for a block or button object, minting one on first use.
   */
  private _idFor(obj: object): string {
    let id = this._blockIds.get(obj);
    if (!id) {
      this._idSeq += 1;
      id = `dsb-${this._idSeq}`;
      this._blockIds.set(obj, id);
    }
    return id;
  }

  /**
   * Re-collects templates and cards, re-renders, and reports the edited config
   * so the bootstrap can persist it.
   */
  private _commit(): void {
    if (!this._config) {
      return;
    }
    this._errors = validateConfig(this._config);
    this._templates.collect(this._config);
    this._restartTick();
    void this._buildCards();
    this.requestUpdate();
    this.dispatchEvent(
      new CustomEvent(CONFIG_CHANGED_EVENT, {
        detail: this._config,
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Appends a new block of the given type to a region and opens its editor.
   */
  private _addBlock(region: Region, type: BlockType): void {
    const cfg = this._config;
    if (!cfg) {
      return;
    }
    const list = cfg[region] ?? (cfg[region] = []);
    list.push(defaultBlock(type));
    this._commit();
    this._editing = { kind: 'block', region, index: list.length - 1 };
  }

  /**
   * Removes the block at a region index.
   */
  private _deleteBlock(region: Region, index: number): void {
    this._config?.[region]?.splice(index, 1);
    this._editing = null;
    this._commit();
  }

  /**
   * Appends a new item to a category and opens its editor.
   */
  private _addCatItem(region: Region, index: number): void {
    const cat = this._config?.[region]?.[index];
    if (cat?.type !== 'category') {
      return;
    }
    cat.items.push(defaultBlock('item') as ItemBlock);
    this._commit();
    this._editing = { kind: 'item', region, index, itemIndex: cat.items.length - 1 };
  }

  /**
   * Removes an item from a category.
   */
  private _deleteCatItem(region: Region, index: number, itemIndex: number): void {
    const cat = this._config?.[region]?.[index];
    if (cat?.type === 'category') {
      cat.items.splice(itemIndex, 1);
      this._commit();
    }
  }

  /**
   * Appends a new footer button and opens its editor.
   */
  private _addFooterButton(): void {
    const cfg = this._config;
    if (!cfg) {
      return;
    }
    const footer = cfg.footer ?? (cfg.footer = {});
    const buttons = footer.buttons ?? (footer.buttons = []);
    buttons.push(defaultFooterButton());
    this._commit();
    this._editing = { kind: 'footer', index: buttons.length - 1 };
  }

  /**
   * Removes the footer button at an index.
   */
  private _deleteFooterButton(index: number): void {
    this._config?.footer?.buttons?.splice(index, 1);
    this._commit();
  }

  /**
   * Switches the footer between button and custom-component mode.
   */
  private _setFooterMode(card: boolean): void {
    const cfg = this._config;
    if (!cfg) {
      return;
    }
    cfg.footer = card ? { card: '' } : { buttons: [] };
    this._commit();
    this._editing = card ? { kind: 'footer-card' } : null;
  }

  /**
   * Writes the modal's edited value back into the config at the edit target.
   */
  private _saveEdit(value: Record<string, unknown>): void {
    const t = this._editing;
    const cfg = this._config;
    if (!t || !cfg) {
      return;
    }
    if (t.kind === 'block') {
      const list = cfg[t.region];
      if (list) {
        list[t.index] = value as unknown as SidebarBlock;
      }
    } else if (t.kind === 'item') {
      const cat = cfg[t.region]?.[t.index];
      if (cat?.type === 'category') {
        cat.items[t.itemIndex] = value as unknown as ItemBlock;
      }
    } else if (t.kind === 'footer') {
      const buttons = cfg.footer?.buttons;
      if (buttons) {
        buttons[t.index] = value as unknown as FooterButtonConfig;
      }
    } else {
      const card = (value as { card?: string | LovelaceCardConfig }).card;
      cfg.footer = { card: card ?? '' };
    }
    this._commit();
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
      }
    });
    if (cfg?.footer?.card !== undefined) {
      specs.push(['footer', cfg.footer.card]);
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
    window.addEventListener('click', this._onDocumentClick);
    this._restartTick();
  }

  /**
   * Removes listeners, stops the clock, and unsubscribes templates on removal.
   */
  public disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('click', this._onDocumentClick);
    this._stopTick();
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
   * Runs a configured tap action through Home Assistant and closes popovers.
   */
  private _runAction(cfg: { entity?: string; tap_action: ItemBlock['tap_action'] }): void {
    if (!this.hass) {
      return;
    }
    handleAction(this, this.hass, { entity: cfg.entity, tap_action: cfg.tap_action }, 'tap');
    this._closePopovers();
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
   * Toggles whether a category is collapsed within the expanded menu.
   */
  private _toggleCategoryCollapse(key: string): void {
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
    const collapsed = this.editMode ? false : this._collapsed;
    const cfg = this._config;
    const classes = {
      sidebar: true,
      'dashboard-sidebar-root': true,
      collapsed,
      [`pos-${this._side}`]: true,
    };
    const sidebarStyle = cfg.background ? { background: cfg.background } : {};

    return html`
      <div class=${classMap(classes)} style=${styleMap(sidebarStyle)}>
        <button
          class="toggle dashboard-sidebar-toggle"
          title=${collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          @click=${this._toggleCollapse}
        >
          <ha-icon icon="mdi:chevron-left"></ha-icon>
        </button>
        ${this._renderRegion('header', cfg.header, collapsed, 'region-header dashboard-sidebar-header')}
        ${this._renderRegion('body', cfg.body, collapsed, 'region-body dashboard-sidebar-body')}
        ${this._renderFooter(collapsed)} ${this._renderTooltip()} ${this._renderBlockModal()}
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
    if (this.editMode) {
      return this._renderEditRegion(region, blocks ?? [], cls);
    }
    if (!blocks?.length) {
      return nothing;
    }
    return html`
      <div class="region ${cls}">
        ${blocks.map((block, i) => this._renderBlock(block, region, i, collapsed))}
      </div>
    `;
  }

  /**
   * Renders a region's blocks with edit controls, plus an add menu, for edit
   * mode.
   */
  private _renderEditRegion(region: Region, blocks: SidebarBlock[], cls: string): TemplateResult {
    const types = region === 'header' ? ADD_TYPES : ADD_TYPES.filter((t) => t !== 'title');
    return html`
      <div class="region ${cls}" data-region=${region}>
        ${blocks.map((block, i) => this._renderEditBlock(region, i, block))}
        ${this._renderAddMenu(types, (type) => this._addBlock(region, type))}
      </div>
    `;
  }

  /**
   * Renders one block wrapped with its edit controls; categories are special.
   */
  private _renderEditBlock(region: Region, index: number, block: SidebarBlock): TemplateResult {
    if (block.type === 'category') {
      return this._renderEditCategory(region, index, block);
    }
    return html`
      <div
        class="edit-block dashboard-sidebar-edit-block"
        data-region=${region}
        data-index=${index}
        data-id=${this._idFor(block)}
        data-type=${block.type}
      >
        <div class="edit-body">${this._renderBlockDisplay(region, index, block)}</div>
        ${this._renderControls(
          () => {
            this._editing = { kind: 'block', region, index };
          },
          () => this._deleteBlock(region, index),
        )}
      </div>
    `;
  }

  /**
   * Renders a category with header controls, per-item controls, and add-item.
   */
  private _renderEditCategory(
    region: Region,
    index: number,
    category: CategoryBlock,
  ): TemplateResult {
    const title = this._templates.resolve(category.title);
    const icon = category.icon ? this._templates.resolve(category.icon) : '';
    return html`
      <div
        class="edit-block dashboard-sidebar-edit-block edit-category"
        data-region=${region}
        data-index=${index}
        data-id=${this._idFor(category)}
        data-type="category"
      >
        <div class="edit-row">
          <div class="edit-body">
            <div class="row category-header">
              ${icon ? html`<ha-icon icon=${icon}></ha-icon>` : nothing}
              <span class="label">${title}</span>
            </div>
          </div>
          ${this._renderControls(
            () => {
              this._editing = { kind: 'block', region, index };
            },
            () => this._deleteBlock(region, index),
          )}
        </div>
        <div class="edit-cat-items" data-cat=${`${region}-${index}`}>
          ${category.items.map((item, j) => this._renderEditItem(region, index, j, item))}
          <button class="edit-add-btn" @click=${() => this._addCatItem(region, index)}>
            ＋ Add item
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Renders one category item row with its edit controls.
   */
  private _renderEditItem(
    region: Region,
    index: number,
    itemIndex: number,
    item: ItemBlock,
  ): TemplateResult {
    return html`
      <div
        class="edit-block edit-item"
        data-region=${region}
        data-index=${index}
        data-item=${itemIndex}
        data-id=${this._idFor(item)}
        data-type="item"
      >
        <div class="edit-body">${this._renderItemRow(item, false)}</div>
        ${this._renderControls(
          () => {
            this._editing = { kind: 'item', region, index, itemIndex };
          },
          () => this._deleteCatItem(region, index, itemIndex),
        )}
      </div>
    `;
  }

  /**
   * Renders the display content of a non-category block for edit mode.
   */
  private _renderBlockDisplay(
    region: Region,
    index: number,
    block: SidebarBlock,
  ): TemplateResult | typeof nothing {
    switch (block.type) {
      case 'title':
        return this._renderTitle(block, false);
      case 'clock':
        return this._renderClock(block, false);
      case 'date':
        return this._renderDate(block, false);
      case 'divider':
        return html`<div class="entry-divider dashboard-sidebar-divider"></div>`;
      case 'item':
        return this._renderItemRow(block, false);
      case 'card':
        return this._renderCardBlock(block, `${region}-${index}`, false);
      default:
        return nothing;
    }
  }

  /**
   * Renders the drag handle, edit, and delete controls for an editable row.
   */
  private _renderControls(onEdit: () => void, onDelete: () => void): TemplateResult {
    return html`
      <span class="edit-controls">
        <span class="edit-handle" title="Drag to reorder"><ha-icon icon="mdi:drag"></ha-icon></span>
        <button class="edit-ctl" title="Edit" @click=${onEdit}>
          <ha-icon icon="mdi:pencil"></ha-icon>
        </button>
        <button class="edit-ctl edit-del" title="Delete" @click=${onDelete}>
          <ha-icon icon="mdi:delete"></ha-icon>
        </button>
      </span>
    `;
  }

  /**
   * Renders an "+ Add" dropdown that inserts a block of the chosen type.
   */
  private _renderAddMenu(types: BlockType[], onPick: (type: BlockType) => void): TemplateResult {
    return html`
      <select
        class="edit-add"
        @change=${(e: Event) => {
          const sel = e.target as HTMLSelectElement;
          if (sel.value) {
            onPick(sel.value as BlockType);
            sel.value = '';
          }
        }}
      >
        <option value="">＋ Add…</option>
        ${types.map((t) => html`<option value=${t}>${t}</option>`)}
      </select>
    `;
  }

  /**
   * Renders the in-place settings modal for the current edit target.
   */
  private _renderBlockModal(): TemplateResult | typeof nothing {
    const t = this._editing;
    const cfg = this._config;
    if (!t || !cfg) {
      return nothing;
    }
    let value: Record<string, unknown> | undefined;
    let mode: 'block' | 'footer' = 'block';
    let heading = 'Edit';
    if (t.kind === 'block') {
      value = cfg[t.region]?.[t.index] as unknown as Record<string, unknown> | undefined;
      heading = `Edit ${String((value as { type?: string })?.type ?? 'block')}`;
    } else if (t.kind === 'item') {
      const cat = cfg[t.region]?.[t.index];
      if (cat?.type === 'category') {
        value = cat.items[t.itemIndex] as unknown as Record<string, unknown>;
      }
      heading = 'Edit item';
    } else if (t.kind === 'footer') {
      value = cfg.footer?.buttons?.[t.index] as unknown as Record<string, unknown> | undefined;
      mode = 'footer';
      heading = 'Edit footer button';
    } else {
      value = { type: 'card', card: cfg.footer?.card ?? '' };
      heading = 'Edit footer card';
    }
    if (!value) {
      return nothing;
    }
    return html`<dashboard-sidebar-block-modal
      .value=${value}
      .mode=${mode}
      .heading=${heading}
      .onSave=${(v: Record<string, unknown>) => this._saveEdit(v)}
      .onClose=${() => {
        this._editing = null;
      }}
    ></dashboard-sidebar-block-modal>`;
  }

  /**
   * Renders one block, dispatching on its type.
   */
  private _renderBlock(
    block: SidebarBlock,
    region: Region,
    index: number,
    collapsed: boolean,
  ): TemplateResult | typeof nothing {
    switch (block.type) {
      case 'title':
        return this._renderTitle(block, collapsed);
      case 'clock':
        return this._renderClock(block, collapsed);
      case 'date':
        return this._renderDate(block, collapsed);
      case 'divider':
        return html`<div
          class="entry-divider dashboard-sidebar-divider${this._hookClass(block)}"
          id=${block.id ?? nothing}
        ></div>`;
      case 'item':
        return this._renderItemRow(block, collapsed);
      case 'category':
        return this._renderCategory(block, `${region}-${index}`, collapsed);
      case 'card':
        return this._renderCardBlock(block, `${region}-${index}`, collapsed);
      default:
        return nothing;
    }
  }

  /**
   * Renders a title block, hidden while collapsed.
   */
  private _renderTitle(block: TitleBlock, collapsed: boolean): TemplateResult | typeof nothing {
    if (collapsed) {
      return nothing;
    }
    const text = this._templates.resolve(block.text);
    const style = { 'text-align': block.align ?? 'center' };
    return html`<div
      class="app-title dashboard-sidebar-title${this._hookClass(block)}"
      id=${block.id ?? nothing}
      style=${styleMap(style)}
    >
      ${text}
    </div>`;
  }

  /**
   * Renders a clock block, using the compact form while collapsed.
   */
  private _renderClock(block: ClockBlock, collapsed: boolean): TemplateResult {
    const style = { 'text-align': block.align ?? 'center' };
    return html`<div
      class="clock dashboard-sidebar-clock${this._hookClass(block)}"
      id=${block.id ?? nothing}
      style=${styleMap(style)}
    >
      ${
        collapsed
          ? formatCollapsedClock(this._now, block.collapsed_format === '12h')
          : formatClock(this._now, block.format ?? 'locale', this._locale)
      }
    </div>`;
  }

  /**
   * Renders a date block, using the compact form while collapsed.
   */
  private _renderDate(block: DateBlock, collapsed: boolean): TemplateResult {
    const style = { 'text-align': block.align ?? 'center' };
    return html`<div
      class="date dashboard-sidebar-date${this._hookClass(block)}"
      id=${block.id ?? nothing}
      style=${styleMap(style)}
    >
      ${
        collapsed
          ? formatCollapsedDate(this._now)
          : formatDate(this._now, block.format ?? 'locale', this._locale)
      }
    </div>`;
  }

  /**
   * Renders a card block wrapper, hidden while collapsed. String cards are
   * shown chrome-less so they do not draw their own box inside the block.
   */
  private _renderCardBlock(
    block: CardBlock,
    key: string,
    collapsed: boolean,
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
      class="content dashboard-sidebar-content${this._hookClass(block)}"
      id=${block.id ?? nothing}
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
    key: string,
    collapsed: boolean,
  ): TemplateResult {
    return collapsed
      ? this._renderCollapsedCategory(category, key)
      : this._renderExpandedCategory(category, key);
  }

  /**
   * Renders a single item row: an icon-only button when collapsed (falling back
   * to initials), or an icon-and-label row when expanded.
   */
  private _renderItemRow(item: ItemBlock, collapsed: boolean): TemplateResult {
    const title = this._templates.resolve(item.title);
    const icon = item.icon ? this._templates.resolve(item.icon) : '';
    const textColor = item.text_color ? this._templates.resolve(item.text_color) : '';
    const iconColor = item.icon_color ? this._templates.resolve(item.icon_color) : '';

    if (collapsed) {
      return html`
        <button
          class="row item collapsed-row dashboard-sidebar-item${this._hookClass(item)}"
          id=${item.id ?? nothing}
          aria-label=${title}
          @mouseenter=${(ev: MouseEvent) => this._showTip(ev, title)}
          @mouseleave=${this._hideTip}
          @click=${() => this._runAction(item)}
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
        class="row item dashboard-sidebar-item${this._hookClass(item)}"
        id=${item.id ?? nothing}
        @click=${() => this._runAction(item)}
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
  private _renderExpandedCategory(category: CategoryBlock, key: string): TemplateResult {
    const title = this._templates.resolve(category.title);
    const icon = category.icon ? this._templates.resolve(category.icon) : '';
    const collapsed = this._collapsedCats.has(key);
    return html`
      <div
        class="category dashboard-sidebar-category${this._hookClass(category)}"
        id=${category.id ?? nothing}
      >
        <button
          class="row category-header dashboard-sidebar-category-header"
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
              >
                ${category.items.map((item) => this._renderItemRow(item, false))}
              </div>`
        }
      </div>
    `;
  }

  /**
   * Renders a collapsed category as an icon button that opens an item popover.
   */
  private _renderCollapsedCategory(category: CategoryBlock, key: string): TemplateResult {
    const title = this._templates.resolve(category.title);
    const icon = category.icon ? this._templates.resolve(category.icon) : '';
    const open = this._openCategory === key;
    return html`
      <div
        class="category-anchor dashboard-sidebar-category${this._hookClass(category)}"
        id=${category.id ?? nothing}
      >
        <button
          class="row item collapsed-row dashboard-sidebar-item ${open ? 'active' : ''}"
          aria-label=${title}
          @mouseenter=${(ev: MouseEvent) => {
            if (!open) {
              this._showTip(ev, title);
            }
          }}
          @mouseleave=${this._hideTip}
          @click=${(ev: Event) => {
            ev.stopPropagation();
            this._toggleCategory(key, ev);
          }}
        >
          ${
            icon
              ? html`<ha-icon class="dashboard-sidebar-item-icon" icon=${icon}></ha-icon>`
              : html`<span class="initials dashboard-sidebar-initials"
                  >${category.abbr ?? initials(title)}</span
                >`
          }
        </button>
        ${open && this._popoverAnchor ? this._renderPopover(category, this._popoverAnchor) : nothing}
      </div>
    `;
  }

  /**
   * Renders a collapsed category's popover: its title and item rows, fixed to
   * the viewport so it escapes the scrollable body's clipping.
   */
  private _renderPopover(category: CategoryBlock, anchor: DOMRect): TemplateResult {
    return html`
      <div
        class="popover dashboard-sidebar-popover"
        style=${styleMap(this._popoverStyle(anchor, false))}
        @click=${(ev: Event) => ev.stopPropagation()}
      >
        <div class="popover-title dashboard-sidebar-popover-title">
          ${this._templates.resolve(category.title)}
        </div>
        ${category.items.map((item) => this._renderItemRow(item, false))}
      </div>
    `;
  }

  /**
   * Renders the footer: a single card, or the icon-button bar with overflow.
   * A card footer shows no dots menu and is hidden while collapsed.
   */
  private _renderFooter(collapsed: boolean): TemplateResult | typeof nothing {
    if (this.editMode) {
      return this._renderEditFooter();
    }
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

    if (footer.card !== undefined) {
      const el = collapsed ? undefined : this._cards.get('footer');
      if (!el) {
        return nothing;
      }
      const style = typeof footer.card === 'string' ? CHROMELESS_CARD : {};
      return html`<div class=${classMap(footerClasses)}>
        <div class="content dashboard-sidebar-content" style=${styleMap(style)}>${el}</div>
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
          ${this._footerOpen && anchor ? this._renderFooterPopover(buttons, anchor) : nothing}
        </div>
      `;
    }

    // Fit as many as the width allows; the rest go behind a dots button.
    const width = this._config?.width ?? 240;
    const maxFit = Math.max(1, Math.floor((width - 24 + 4) / 44)); // 40px button + 4px gap
    if (buttons.length <= maxFit) {
      return html`<div class=${classMap(footerClasses)}>
        ${buttons.map((btn) => this._renderFooterButton(btn))}
      </div>`;
    }
    const inline = buttons.slice(0, maxFit - 1);
    const overflow = buttons.slice(maxFit - 1);
    return html`
      <div class=${classMap(footerClasses)}>
        ${inline.map((btn) => this._renderFooterButton(btn))}
        ${this._renderDots('footer-btn dashboard-sidebar-footer-btn dashboard-sidebar-footer-more')}
        ${this._footerOpen && anchor ? this._renderFooterPopover(overflow, anchor) : nothing}
      </div>
    `;
  }

  /**
   * Renders the footer editor: a mode toggle, then button rows with controls
   * or the custom-component display.
   */
  private _renderEditFooter(): TemplateResult {
    const footer = this._config?.footer;
    const cardMode = footer?.card !== undefined;
    return html`
      <div class="footer dashboard-sidebar-footer edit-footer">
        <div class="edit-footer-modes">
          <button
            class="edit-add-btn ${cardMode ? '' : 'sel'}"
            @click=${() => this._setFooterMode(false)}
          >
            Buttons
          </button>
          <button
            class="edit-add-btn ${cardMode ? 'sel' : ''}"
            @click=${() => this._setFooterMode(true)}
          >
            Component
          </button>
        </div>
        ${
          cardMode
            ? html`<div class="edit-block" data-type="footer-card">
                <div class="edit-body"><span class="rsum">Custom component</span></div>
                <span class="edit-controls">
                  <button
                    class="edit-ctl"
                    title="Edit"
                    @click=${() => {
                      this._editing = { kind: 'footer-card' };
                    }}
                  >
                    <ha-icon icon="mdi:pencil"></ha-icon>
                  </button>
                </span>
              </div>`
            : html`
                ${(footer?.buttons ?? []).map(
                  (btn, i) => html`
                    <div
                      class="edit-block edit-footer-btn"
                      data-index=${i}
                      data-id=${this._idFor(btn)}
                    >
                      <div class="edit-body">
                        <ha-icon icon=${this._templates.resolve(btn.icon)}></ha-icon>
                        <span class="rsum"
                          >${btn.title ? this._templates.resolve(btn.title) : this._templates.resolve(btn.icon)}</span
                        >
                      </div>
                      ${this._renderControls(
                        () => {
                          this._editing = { kind: 'footer', index: i };
                        },
                        () => this._deleteFooterButton(i),
                      )}
                    </div>
                  `,
                )}
                <button class="edit-add-btn" @click=${() => this._addFooterButton()}>
                  ＋ Add button
                </button>
              `
        }
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
  private _renderFooterPopover(buttons: FooterButtonConfig[], anchor: DOMRect): TemplateResult {
    return html`
      <div
        class="popover footer-popover dashboard-sidebar-popover dashboard-sidebar-footer-popover"
        style=${styleMap(this._popoverStyle(anchor, true))}
        @click=${(ev: Event) => ev.stopPropagation()}
      >
        ${buttons.map((btn) => this._renderFooterButton(btn))}
      </div>
    `;
  }

  /**
   * Renders a single footer icon button that runs its configured action.
   */
  private _renderFooterButton(btn: FooterButtonConfig): TemplateResult {
    const icon = this._templates.resolve(btn.icon);
    const color = btn.icon_color ? this._templates.resolve(btn.icon_color) : '';
    const title = btn.title ? this._templates.resolve(btn.title) : '';
    return html`
      <button
        class="footer-btn dashboard-sidebar-footer-btn${this._hookClass(btn)}"
        id=${btn.id ?? nothing}
        aria-label=${title}
        @mouseenter=${(ev: MouseEvent) => this._showTip(ev, title)}
        @mouseleave=${this._hideTip}
        @click=${() => this._runAction(btn)}
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
