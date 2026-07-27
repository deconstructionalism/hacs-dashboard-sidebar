import {
  type ActionConfig,
  type HomeAssistant,
  type LovelaceCardConfig,
  handleAction,
} from 'custom-card-helpers';
import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type {
  BlockType,
  CategoryBlock,
  DashboardSidebarConfig,
  FooterButtonConfig,
  ItemBlock,
  Region,
  SidebarBlock,
} from '../lib/types';
import type { DashboardSidebar } from '../dashboard-sidebar';
import '../dashboard-sidebar';
import { PREVIEW_REORDER_EVENT, PREVIEW_SELECT_EVENT } from '../lib/const';
import { validateConfig } from '../lib/validate';
import { defaultBlock, defaultFooterButton } from './arrange';
import {
  areaField,
  blockFields,
  checkboxField,
  colorField,
  footerButtonFields,
  iconChoiceField,
  intField,
  type Patch,
  titleCase,
  type ValidationCtx,
  validateWidth,
} from './block-form';

/** Every block type, offered when adding to the header. */
const ALL_TYPES: BlockType[] = ['title', 'clock', 'date', 'divider', 'item', 'category', 'card'];

/** The modal tabs, in order. `body` is labelled "Content". */
const TABS: Array<{ id: 'settings' | 'header' | 'body' | 'footer'; label: string }> = [
  { id: 'settings', label: 'Settings' },
  { id: 'header', label: 'Header' },
  { id: 'body', label: 'Content' },
  { id: 'footer', label: 'Footer' },
];

/** The resolved location of the selected element within the working copy. */
type Selected =
  | { kind: 'block'; region: Region; index: number; block: SidebarBlock }
  | { kind: 'item'; region: Region; index: number; itemIndex: number; item: ItemBlock }
  | { kind: 'footer'; index: number; btn: FooterButtonConfig };

/**
 * The visual editor for one dashboard_sidebar. Opened by the bootstrap in
 * dashboard edit mode; edits a working copy of the config and hands it back
 * through `onSave`. Every element is edited here, in this one modal.
 */
@customElement('dashboard-sidebar-editor')
export class DashboardSidebarEditor extends LitElement {
  /** The current Home Assistant object, for future entity/action pickers. */
  @property({ attribute: false }) public hass?: HomeAssistant;

  /** The config to edit. Cloned into a working copy on assignment. */
  @property({ attribute: false }) public config?: DashboardSidebarConfig;

  /** Called with the edited config when the user saves. */
  @property({ attribute: false }) public onSave?: (config: DashboardSidebarConfig) => void;

  /** Called when the editor should close (cancel or after save). */
  @property({ attribute: false }) public onClose?: () => void;

  /** The active tab. */
  @state() private _tab: 'settings' | 'header' | 'body' | 'footer' = 'settings';

  /** Stable id of the element selected for editing in the preview, or null. */
  @state() private _selected: string | null = null;

  /** Per-field validation errors, keyed by field name within the current form. */
  @state() private _fieldErrors: Record<string, string> = {};

  /** Whether the unsaved-changes exit confirmation is showing. */
  @state() private _confirmingClose = false;

  /** Tabs whose preview is showing the collapsed (icon-strip) look. */
  @state() private _collapsedTabs = new Set<string>();

  /** Ids of categories shown collapsed in the preview (toggled via their menu). */
  @state() private _previewCollapsedCats = new Set<string>();

  /** Whether the add-element menu is open. */
  @state() private _addMenuOpen = false;

  /** Anchor rect and choices for the open add menu. */
  private _addMenuRect: DOMRect | null = null;
  private _addMenuItems: Array<{ label: string; run: () => void }> = [];

  /** Whether the selected element's overflow ("...") menu is open. */
  @state() private _elementMenuOpen = false;

  /** Anchor rect of the overflow menu's trigger. */
  private _elementMenuRect: DOMRect | null = null;

  /** Whether the current tab's options ("...") menu is open. */
  @state() private _tabMenuOpen = false;

  /** Anchor rect of the tab options menu's trigger. */
  private _tabMenuRect: DOMRect | null = null;

  /** Validation errors from the last save attempt. */
  @state() private _errors: string[] = [];

  /** The config as first loaded, serialized, to detect unsaved changes. */
  private _initialJson = '{}';

  /** The mutable working copy of the config. */
  private _working: DashboardSidebarConfig = {};

  /** Stable ids per row object, for keyed rendering under drag-and-drop. */
  private readonly _ids = new WeakMap<object, string>();

  /** Monotonic counter backing the id map. */
  private _idSeq = 0;

  /** Cached preview sidebar elements, one per region key (header/body/footer). */
  private readonly _previews = new Map<string, DashboardSidebar>();

  /** Last config serialized into each preview, to skip redundant rebuilds. */
  private readonly _previewCfg = new WeakMap<DashboardSidebar, string>();

  /**
   * Clones the incoming config into the working copy.
   */
  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('config')) {
      this._working = this.config ? (structuredClone(this.config) as DashboardSidebarConfig) : {};
      this._initialJson = JSON.stringify(this.config ?? {});
      this._fieldErrors = {};
      this._selected = null;
      this._confirmingClose = false;
      this._collapsedTabs = new Set();
      this._previewCollapsedCats = new Set();
      this._addMenuOpen = false;
      this._elementMenuOpen = false;
      this._tabMenuOpen = false;
    }
  }

  /**
   * Preloads Home Assistant's code editor so the fields can use it.
   */
  protected firstUpdated(): void {
    void this._ensureCodeEditor();
  }

  /**
   * Best-effort load of `<ha-code-editor>` (lazily registered by HA's own card
   * editors) by pulling in the markdown-card config element, then re-renders so
   * the fields upgrade from the plain-input fallback to the code editor.
   */
  private async _ensureCodeEditor(): Promise<void> {
    if (customElements.get('ha-code-editor')) {
      return;
    }
    try {
      const helpers = await (
        window as unknown as { loadCardHelpers?: () => Promise<Record<string, unknown>> }
      ).loadCardHelpers?.();
      const card = (
        helpers as { createCardElement?: (c: unknown) => HTMLElement } | undefined
      )?.createCardElement?.({ type: 'markdown', content: '' });
      await (
        card?.constructor as { getConfigElement?: () => Promise<unknown> } | undefined
      )?.getConfigElement?.();
    } catch {
      // Could not preload the editor; fields keep the text-input fallback.
    }
    if (customElements.get('ha-code-editor')) {
      this.requestUpdate();
    }
  }

  /**
   * Whether the current tab's preview is showing the collapsed look.
   */
  private get _tabCollapsed(): boolean {
    return this._collapsedTabs.has(this._tab);
  }

  /**
   * Whether the working copy differs from the config as first loaded.
   */
  private get _dirty(): boolean {
    return JSON.stringify(this._working) !== this._initialJson;
  }

  /**
   * Whether any field currently has an inline validation error.
   */
  private get _hasFieldErrors(): boolean {
    return Object.keys(this._fieldErrors).length > 0;
  }

  /**
   * Whether Save is allowed: there are unsaved changes and no field errors.
   */
  private get _canSave(): boolean {
    return this._dirty && !this._hasFieldErrors;
  }

  /**
   * Validates one field's value on blur and records or clears its error.
   */
  private _validateField(key: string, value: string, validate: (v: string) => string | null): void {
    const error = validate(value);
    const next = { ...this._fieldErrors };
    if (error) {
      next[key] = error;
    } else {
      delete next[key];
    }
    this._fieldErrors = next;
  }

  /**
   * The validation context passed to the block form's fields.
   */
  private _ctx(): ValidationCtx {
    return {
      errorFor: (key) => this._fieldErrors[key],
      onBlur: (key, value, validate) => this._validateField(key, value, validate),
    };
  }

  /**
   * Re-renders after an in-place mutation of the working copy.
   */
  private _touch(): void {
    this.requestUpdate();
  }

  /**
   * Returns a stable id for a row object, minting one on first use.
   */
  private _idFor(obj: object): string {
    let id = this._ids.get(obj);
    if (!id) {
      this._idSeq += 1;
      id = `r${this._idSeq}`;
      this._ids.set(obj, id);
    }
    return id;
  }

  /**
   * The location string of the current selection (matching the `data-loc` the
   * preview stamps on each element), or undefined when nothing is selected.
   */
  private _selectedLoc(): string | undefined {
    return this._selected ? this._locOf(this._selected) : undefined;
  }

  /**
   * The location string for an element id (matching the preview's `data-loc`),
   * or undefined when the id no longer resolves.
   */
  private _locOf(id: string): string | undefined {
    const sel = this._locate(id);
    if (!sel) {
      return undefined;
    }
    if (sel.kind === 'block') {
      return `${sel.region}:${sel.index}`;
    }
    if (sel.kind === 'item') {
      return `${sel.region}:${sel.index}.${sel.itemIndex}`;
    }
    return `footer:btn:${sel.index}`;
  }

  /**
   * The location strings of categories currently shown collapsed in the preview.
   */
  private _collapsedCatLocs(): string[] {
    return [...this._previewCollapsedCats]
      .map((id) => this._locOf(id))
      .filter((loc): loc is string => loc !== undefined);
  }

  /**
   * Resolves a preview location string back to a selectable element's stable id,
   * or null when it does not resolve (e.g. the footer card, which is edited
   * through its own field rather than the selection form).
   */
  private _idForLoc(loc: string): string | null {
    if (loc === 'footer:card') {
      return null;
    }
    if (loc.startsWith('footer:btn:')) {
      const btn = this._working.footer?.buttons?.[Number(loc.slice('footer:btn:'.length))];
      return btn ? this._idFor(btn) : null;
    }
    const [region, rest] = loc.split(':');
    const dot = rest.indexOf('.');
    const index = dot === -1 ? Number(rest) : Number(rest.slice(0, dot));
    const block = this._working[region as Region]?.[index];
    if (!block) {
      return null;
    }
    if (dot === -1) {
      return this._idFor(block);
    }
    if (block.type === 'category') {
      const item = block.items?.[Number(rest.slice(dot + 1))];
      return item ? this._idFor(item) : null;
    }
    return null;
  }

  /**
   * Selects the element a preview click identified, resetting field errors when
   * the selection changes. Choosing a category sub-item from the collapsed
   * popover expands the preview so the item is visible where it was selected.
   */
  private _onPreviewSelect(loc: string): void {
    const id = this._idForLoc(loc);
    if (!id) {
      return;
    }
    if (id !== this._selected) {
      this._fieldErrors = {};
    }
    this._selected = id;
    if (this._tabCollapsed && loc.includes('.')) {
      const next = new Set(this._collapsedTabs);
      next.delete(this._tab);
      this._collapsedTabs = next;
    }
  }

  /**
   * Returns the working-copy array backing a preview drag container: a region's
   * blocks (`body`), a category's items (`body:1`), or the footer buttons.
   */
  private _containerArray(container: string): unknown[] | undefined {
    if (container === 'footer') {
      return this._working.footer?.buttons;
    }
    const [region, cat] = container.split(':');
    if (cat === undefined) {
      return this._working[region as Region];
    }
    return this._category(region as Region, Number(cat))?.items;
  }

  /**
   * Applies a preview drag-reorder to the working copy: moves the element from
   * its source container/index to the destination, then evicts the affected
   * preview so it rebuilds cleanly from the new order.
   */
  private _applyReorder(detail: {
    from: string;
    to: string;
    oldIndex?: number;
    newIndex?: number;
  }): void {
    const { from, to, oldIndex, newIndex } = detail;
    const src = this._containerArray(from);
    const dst = this._containerArray(to);
    if (!src || !dst || oldIndex === undefined || newIndex === undefined) {
      return;
    }
    const [moved] = src.splice(oldIndex, 1);
    if (moved === undefined) {
      return;
    }
    dst.splice(newIndex, 0, moved);
    this._selected = this._idFor(moved as object);
    this._previews.delete(to === 'footer' ? 'footer' : to.split(':')[0]);
    this._touch();
  }

  /**
   * Finds the currently selected element and its location in the working copy,
   * or null when nothing is selected or the selection no longer exists.
   */
  private _locate(id: string | null): Selected | null {
    if (!id) {
      return null;
    }
    for (const region of ['header', 'body'] as Region[]) {
      const blocks = this._working[region] ?? [];
      for (let i = 0; i < blocks.length; i += 1) {
        const block = blocks[i];
        if (this._ids.get(block) === id) {
          return { kind: 'block', region, index: i, block };
        }
        if (block.type === 'category') {
          const items = block.items ?? [];
          for (let j = 0; j < items.length; j += 1) {
            if (this._ids.get(items[j]) === id) {
              return { kind: 'item', region, index: i, itemIndex: j, item: items[j] };
            }
          }
        }
      }
    }
    const buttons = this._working.footer?.buttons ?? [];
    for (let i = 0; i < buttons.length; i += 1) {
      if (this._ids.get(buttons[i]) === id) {
        return { kind: 'footer', index: i, btn: buttons[i] };
      }
    }
    return null;
  }

  /**
   * Whether a block still renders in the collapsed (icon-strip) sidebar: titles
   * and cards are hidden, everything else shows.
   */
  private _visibleCollapsed(block: SidebarBlock): boolean {
    return block.type !== 'title' && block.type !== 'card';
  }

  /**
   * On collapsing the preview, keeps the selection meaningful: a category
   * sub-item hands off to its parent category (shown as an icon); a top-level
   * block that is hidden when collapsed hands off to the next visible sibling,
   * or the previous one, or nothing when the region has no visible elements. A
   * selection that already shows collapsed, or an empty selection, is left as-is.
   */
  private _reselectForCollapse(): void {
    const sel = this._locate(this._selected);
    if (!sel) {
      return;
    }
    if (sel.kind === 'item') {
      const cat = this._working[sel.region]?.[sel.index];
      this._selected = cat ? this._idFor(cat) : null;
      return;
    }
    if (sel.kind === 'footer' || this._visibleCollapsed(sel.block)) {
      return;
    }
    const blocks = this._working[sel.region] ?? [];
    let pick: SidebarBlock | undefined;
    for (let i = sel.index + 1; i < blocks.length && !pick; i += 1) {
      if (this._visibleCollapsed(blocks[i])) {
        pick = blocks[i];
      }
    }
    for (let i = sel.index - 1; i >= 0 && !pick; i -= 1) {
      if (this._visibleCollapsed(blocks[i])) {
        pick = blocks[i];
      }
    }
    this._selected = pick ? this._idFor(pick) : null;
  }

  /**
   * The array and index of the selected element within its own container (its
   * region blocks, a category's items, or the footer buttons), or null.
   */
  private _selectedContainer(): { arr: unknown[]; index: number } | null {
    const sel = this._locate(this._selected);
    if (!sel) {
      return null;
    }
    if (sel.kind === 'block') {
      const arr = this._working[sel.region];
      return arr ? { arr, index: sel.index } : null;
    }
    if (sel.kind === 'item') {
      const cat = this._working[sel.region]?.[sel.index];
      return cat?.type === 'category' ? { arr: cat.items, index: sel.itemIndex } : null;
    }
    const buttons = this._working.footer?.buttons;
    return buttons ? { arr: buttons, index: sel.index } : null;
  }

  /**
   * Moves the selected element one slot up (-1) or down (+1) within its
   * container, clamped to the ends.
   */
  private _moveSelected(delta: number): void {
    const c = this._selectedContainer();
    if (!c) {
      return;
    }
    const to = c.index + delta;
    if (to < 0 || to >= c.arr.length) {
      return;
    }
    const [moved] = c.arr.splice(c.index, 1);
    c.arr.splice(to, 0, moved);
    this._touch();
  }

  /**
   * Opens the selected element's overflow ("...") menu, anchored to its trigger.
   */
  private _openElementMenu(ev: Event): void {
    ev.stopPropagation();
    this._elementMenuRect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    this._elementMenuOpen = true;
  }

  /**
   * The selected element's entity/tap action when it has one (items and footer
   * buttons), or null — used to offer "Test action" in the overflow menu.
   */
  private _actionable(): { entity?: string; tap_action: ActionConfig } | null {
    const sel = this._locate(this._selected);
    if (!sel) {
      return null;
    }
    if (sel.kind === 'footer') {
      return sel.btn;
    }
    if (sel.kind === 'item') {
      return sel.item;
    }
    if (sel.kind === 'block' && sel.block.type === 'item') {
      return sel.block;
    }
    return null;
  }

  /**
   * Runs the selected element's tap action against the live Home Assistant, so
   * its behavior can be tested from the editor without a preview click firing it.
   */
  private _testAction(): void {
    const cfg = this._actionable();
    if (!cfg || !this.hass) {
      return;
    }
    handleAction(this, this.hass, { entity: cfg.entity, tap_action: cfg.tap_action }, 'tap');
    this._elementMenuOpen = false;
  }

  /**
   * Merges a partial update into the top-level sidebar settings.
   */
  private _patchConfig(partial: Record<string, unknown>): void {
    Object.assign(this._working, partial);
    this._touch();
  }

  /**
   * Appends a new block of the given type to a region.
   */
  private _addBlock(region: Region, type: BlockType): void {
    const list = this._working[region] ?? (this._working[region] = []);
    const block = defaultBlock(type);
    const selIndex = list.findIndex((b) => this._ids.get(b) === this._selected);
    if (selIndex >= 0) {
      list.splice(selIndex + 1, 0, block);
    } else {
      list.push(block);
    }
    this._selected = this._idFor(block);
    this._touch();
  }

  /**
   * Removes the block at a region index.
   */
  private _removeBlock(region: Region, index: number): void {
    this._working[region]?.splice(index, 1);
    this._touch();
  }

  /**
   * Merges a partial update into the block at a region index.
   */
  private _patchBlock(region: Region, index: number, partial: Record<string, unknown>): void {
    const block = this._working[region]?.[index];
    if (block) {
      Object.assign(block, partial);
      this._touch();
    }
  }

  /**
   * Returns the category at a region index, or undefined.
   */
  private _category(region: Region, index: number): CategoryBlock | undefined {
    const block = this._working[region]?.[index];
    return block?.type === 'category' ? block : undefined;
  }

  /**
   * Adds an item to a category, after the selected item when one is selected.
   */
  private _addItem(region: Region, index: number): void {
    const cat = this._category(region, index);
    if (cat) {
      const item = defaultBlock('item') as ItemBlock;
      const selItemIndex = cat.items.findIndex((it) => this._ids.get(it) === this._selected);
      if (selItemIndex >= 0) {
        cat.items.splice(selItemIndex + 1, 0, item);
      } else {
        cat.items.push(item);
      }
      this._selected = this._idFor(item);
    }
    this._touch();
  }

  /**
   * Removes an item from a category.
   */
  private _removeItem(region: Region, index: number, itemIndex: number): void {
    this._category(region, index)?.items.splice(itemIndex, 1);
    this._touch();
  }

  /**
   * Merges a partial update into a category item.
   */
  private _patchItem(
    region: Region,
    index: number,
    itemIndex: number,
    partial: Record<string, unknown>,
  ): void {
    const item = this._category(region, index)?.items[itemIndex];
    if (item) {
      Object.assign(item, partial);
      this._touch();
    }
  }

  /**
   * Switches the footer between button and custom-component mode, keeping the
   * divider setting.
   */
  private _setFooterMode(card: boolean): void {
    const divider = this._working.footer?.divider;
    this._working.footer = card ? { card: '', divider } : { buttons: [], divider };
    this._touch();
  }

  /**
   * Toggles the footer's top divider bar.
   */
  private _setFooterDivider(show: boolean): void {
    const footer = this._working.footer ?? (this._working.footer = {});
    footer.divider = show;
    this._touch();
  }

  /**
   * Appends a new footer button.
   */
  private _addFooterButton(): void {
    const footer = this._working.footer ?? (this._working.footer = {});
    const list = footer.buttons ?? (footer.buttons = []);
    const btn = defaultFooterButton();
    const selIndex = list.findIndex((b) => this._ids.get(b) === this._selected);
    if (selIndex >= 0) {
      list.splice(selIndex + 1, 0, btn);
    } else {
      list.push(btn);
    }
    this._selected = this._idFor(btn);
    this._touch();
  }

  /**
   * Removes a footer button.
   */
  private _removeFooterButton(index: number): void {
    this._working.footer?.buttons?.splice(index, 1);
    this._touch();
  }

  /**
   * Merges a partial update into a footer button.
   */
  private _patchFooterButton(index: number, partial: Record<string, unknown>): void {
    const btn = this._working.footer?.buttons?.[index];
    if (btn) {
      Object.assign(btn, partial);
      this._touch();
    }
  }

  /**
   * Sets the footer card content, parsing JSON objects.
   */
  private _setFooterCard(value: string): void {
    const trimmed = value.trim();
    let card: string | LovelaceCardConfig = value;
    if (trimmed.startsWith('{')) {
      try {
        card = JSON.parse(trimmed) as LovelaceCardConfig;
      } catch {
        card = value;
      }
    }
    this._working.footer = { card, divider: this._working.footer?.divider };
    this._touch();
  }

  /**
   * Validates the working copy and, when valid, saves and closes.
   */
  private _save(): void {
    this._errors = validateConfig(this._working);
    if (this._errors.length > 0) {
      return;
    }
    this.onSave?.(this._working);
    this.onClose?.();
  }

  /**
   * Requests a close: confirms first when there are unsaved changes.
   */
  private _close(): void {
    if (this._dirty) {
      this._confirmingClose = true;
      return;
    }
    this.onClose?.();
  }

  /**
   * Renders the modal shell: the three sections, errors, and actions.
   */
  protected render(): TemplateResult {
    return html`
      <div class="backdrop" @click=${this._close}></div>
      <div class="panel" role="dialog" aria-label="Edit Dashboard Sidebar">
        <header>
          <h2>Edit Dashboard Sidebar</h2>
          <button class="icon" title="Close" @click=${this._close}>✕</button>
        </header>
        <div class="tabs">
          ${TABS.map(
            (t) => html`
              <button
                class="tab ${this._tab === t.id ? 'active' : ''}"
                @click=${() => {
                  this._tab = t.id;
                  this._fieldErrors = {};
                  this._addMenuOpen = false;
                  this._elementMenuOpen = false;
                  this._tabMenuOpen = false;
                  this._selected = null;
                }}
              >
                ${t.label}
              </button>
            `,
          )}
        </div>
        <div class="content">${this._renderTab()}</div>
        ${
          this._errors.length > 0
            ? html`<ul class="errors">
                ${this._errors.map((e) => html`<li>${e}</li>`)}
              </ul>`
            : nothing
        }
        <footer>
          <button @click=${this._close}>Cancel</button>
          <button class="primary" ?disabled=${!this._canSave} @click=${this._save}>Save</button>
        </footer>
        ${this._confirmingClose ? this._renderConfirmClose() : nothing}
      </div>
      ${this._renderAddMenuPopup()} ${this._renderElementMenu()} ${this._renderTabMenu()}
    `;
  }

  /**
   * Renders the unsaved-changes exit confirmation over the panel.
   */
  private _renderConfirmClose(): TemplateResult {
    return html`
      <div class="confirm-scrim">
        <div class="confirm" role="alertdialog" aria-label="Unsaved changes">
          <p>You have unsaved changes. Exit without saving?</p>
          <div class="confirm-actions">
            <button
              @click=${() => {
                this._confirmingClose = false;
              }}
            >
              Keep editing
            </button>
            <button
              class="danger-btn"
              @click=${() => {
                this._confirmingClose = false;
                this.onClose?.();
              }}
            >
              Discard changes
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renders the active tab's content.
   */
  private _renderTab(): TemplateResult {
    switch (this._tab) {
      case 'settings':
        return this._renderSettings();
      case 'header':
        return this._renderSplit('header');
      case 'body':
        return this._renderSplit('body');
      case 'footer':
        return this._renderFooterTab();
      default:
        return html``;
    }
  }

  /**
   * Renders the sidebar-level settings form.
   */
  private _renderSettings(): TemplateResult {
    const c = this._working;
    return html`
      <section class="region settings">
        ${iconChoiceField(
          'Sidebar Position',
          c.position ?? 'left',
          [
            { value: 'left', icon: 'mdi:dock-left', title: 'Left' },
            { value: 'right', icon: 'mdi:dock-right', title: 'Right' },
          ],
          (v) => this._patchConfig({ position: v }),
        )}
        ${intField('Expanded Width (px)', c.width, (v) => this._patchConfig({ width: v }), {
          error: this._fieldErrors['width'],
          onBlur: (v) => this._validateField('width', v, validateWidth),
        })}
        ${checkboxField(
          'Start Collapsed',
          c.start_collapsed ?? false,
          // Store undefined (not false) when off so the key is dropped and an
          // off-then-on-then-off toggle returns cleanly to the original config.
          (v) => this._patchConfig({ start_collapsed: v || undefined }),
          'Load the sidebar collapsed to its icon strip; it expands when you tap the toggle.',
        )}
        ${checkboxField(
          'Hide Sidebar On Mobile',
          c.hide_on_mobile ?? false,
          (v) => this._patchConfig({ hide_on_mobile: v || undefined }),
          'Hide the sidebar entirely on narrow (phone-width) screens.',
        )}
        ${colorField('Background CSS Color', c.background, (v) =>
          this._patchConfig({ background: v || undefined }),
        )}
      </section>
    `;
  }

  /**
   * Renders a highlighted info callout describing a tab's scroll behavior.
   */
  private _editorNote(text: string): TemplateResult {
    return html`<div class="editor-note">
      <ha-icon icon="mdi:information-outline"></ha-icon>
      <span>${text}</span>
    </div>`;
  }

  /**
   * Renders a region (header or body) as a two-column split: the edit panel on
   * the left, the live, drag-reorderable preview on the right.
   */
  private _renderSplit(region: Region): TemplateResult {
    const notes = this._renderTabNotes(
      region === 'header'
        ? 'The header is pinned to the top of the sidebar and does not scroll.'
        : 'Content scrolls on its own when it is taller than the sidebar.',
      region === 'header'
        ? 'Collapsed: only clock and date blocks show — titles are hidden.'
        : 'Collapsed: items and categories show as icons — card blocks are hidden.',
    );
    const blocks = this._working[region] ?? [];
    if (blocks.length === 0) {
      return html`
        ${notes} ${this._renderEmptyState(this._renderAddMenu(this._typeItems(region)))}
      `;
    }
    // The header is pinned to the top, so cross-hatch the space below it to
    // stand in for the content that would follow; the body is itself the
    // scrolling content, so it fills the frame as-is.
    const preview =
      region === 'header'
        ? this._renderPreview(
            html`${this._renderRegionPreview(region)}${this._renderGhost('down')}`,
            true,
          )
        : this._renderPreview(this._renderRegionPreview(region));
    return html`
      ${notes}
      <div class="split ${this._tabCollapsed ? 'pv-collapsed' : ''}">
        <div class="editor">${this._renderSelectedForm()}</div>
        ${preview}
      </div>
    `;
  }

  /**
   * Renders the borderless empty-state for a region with no elements: a short
   * explanation that the area only appears once it has content, plus the given
   * add control. No preview frame, so an empty area is not made to look as if it
   * renders anything.
   */
  private _renderEmptyState(add: TemplateResult): TemplateResult {
    return html`
      <div class="empty-state">
        <p class="empty-msg">Add your first element for this area to show up.</p>
        ${add}
      </div>
    `;
  }

  /**
   * Renders the full-width notes above the split: the tab's scroll-behavior note
   * (with its divider line), then the collapsed-state note below that line when
   * the preview is collapsed.
   */
  private _renderTabNotes(
    scrollNote: string,
    collapsedNote: string,
    menu: TemplateResult | typeof nothing = nothing,
  ): TemplateResult {
    return html`
      <div class="tab-notes">
        <p class="tab-note">${scrollNote}</p>
        ${menu}
      </div>
      ${this._tabCollapsed ? this._editorNote(collapsedNote) : nothing}
    `;
  }

  /**
   * Renders the current tab's options ("...") menu trigger, shown at the right
   * of the tab notes row.
   */
  private _renderTabMenuButton(): TemplateResult {
    return html`
      <button
        class="tool"
        title="Footer options"
        aria-label="Footer options"
        @click=${(e: Event) => {
          e.stopPropagation();
          this._tabMenuRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          this._tabMenuOpen = true;
        }}
      >
        <ha-icon icon="mdi:dots-vertical"></ha-icon>
      </button>
    `;
  }

  /**
   * Renders the footer tab's options menu, fixed under its trigger: toggles for
   * the top divider bar and the buttons/component mode.
   */
  private _renderTabMenu(): TemplateResult | typeof nothing {
    const rect = this._tabMenuRect;
    if (!this._tabMenuOpen || !rect || this._tab !== 'footer') {
      return nothing;
    }
    const footer = this._working.footer;
    const cardMode = footer?.card !== undefined;
    const dividerShown = footer?.divider ?? true;
    return html`
      <div
        class="menu-scrim"
        @click=${() => {
          this._tabMenuOpen = false;
        }}
      ></div>
      <div
        class="add-menu"
        style="top: ${rect.bottom + 4}px; right: ${Math.max(8, window.innerWidth - rect.right)}px"
      >
        <button
          class="add-menu-item"
          @click=${() => {
            this._setFooterDivider(!dividerShown);
            this._tabMenuOpen = false;
          }}
        >
          ${dividerShown ? 'Hide' : 'Show'} Top Divider Bar
        </button>
        <button
          class="add-menu-item"
          @click=${() => {
            this._setFooterMode(!cardMode);
            this._tabMenuOpen = false;
          }}
        >
          ${cardMode ? 'Show As Buttons' : 'Show As Component'}
        </button>
      </div>
    `;
  }

  /**
   * Renders faded skeleton rows standing in for the content beside a pinned
   * region: fading up (toward the top) above a footer, or down (toward the
   * bottom) below a header.
   */
  private _renderGhost(fade: 'up' | 'down'): TemplateResult {
    const widths = [72, 54, 84, 48, 66, 60, 78, 50];
    return html`
      <div class="pv-ghost fade-${fade}">
        ${widths.map(
          (w) =>
            html`<div class="ghost-row">
              <span class="ghost-icon"></span><span class="ghost-bar" style="width: ${w}%"></span>
            </div>`,
        )}
      </div>
    `;
  }

  /**
   * Wraps preview content in the preview column: a "Preview" heading with an
   * expand/collapse toggle, and the sidebar frame (narrowed when collapsed) so
   * the user can see both the expanded and collapsed looks.
   */
  private _renderPreview(content: TemplateResult, column = false): TemplateResult {
    return html`
      <div class="preview">
        <div class="preview-head">
          <span class="preview-title">Preview</span>
          <button
            class="pv-toggle"
            title=${this._tabCollapsed ? 'Show expanded' : 'Show collapsed'}
            aria-label=${this._tabCollapsed ? 'Show expanded' : 'Show collapsed'}
            @click=${() => {
              const next = new Set(this._collapsedTabs);
              const collapsing = !next.has(this._tab);
              if (collapsing) {
                next.add(this._tab);
              } else {
                next.delete(this._tab);
              }
              this._collapsedTabs = next;
              this._addMenuOpen = false;
              this._elementMenuOpen = false;
              if (collapsing) {
                this._reselectForCollapse();
              }
            }}
          >
            <ha-icon
              icon=${
                this._tabCollapsed ? 'mdi:arrow-expand-horizontal' : 'mdi:arrow-collapse-horizontal'
              }
            ></ha-icon>
          </button>
        </div>
        <div
          class="pv-frame ${this._tabCollapsed ? 'collapsed' : ''} ${column ? 'pv-col' : ''}"
          style="background: ${this._working.background ?? ''}"
        >
          ${content}
        </div>
      </div>
    `;
  }

  /**
   * Renders the region preview: the real sidebar element rendering just this
   * region, in select-and-drag preview mode. Only called for a non-empty region
   * (the empty case shows a borderless empty-state instead).
   */
  private _renderRegionPreview(region: Region): TemplateResult {
    const blocks = this._working[region] ?? [];
    return html`${this._previewEl(region, { [region]: blocks })}`;
  }

  /**
   * Renders the footer tab: a mode toggle and, per mode, the button editor or
   * the card field, each split into edit controls and a live preview.
   */
  private _renderFooterTab(): TemplateResult {
    const footer = this._working.footer;
    const cardMode = footer?.card !== undefined;
    const empty = !cardMode && (footer?.buttons?.length ?? 0) === 0;
    const notes = this._renderTabNotes(
      'The footer is pinned to the bottom of the sidebar and does not scroll.',
      cardMode
        ? 'Collapsed: the footer component is hidden.'
        : 'Collapsed: footer buttons collapse into a single menu button.',
      // No options menu until the footer has content: divider/mode do not apply.
      empty ? nothing : this._renderTabMenuButton(),
    );
    if (empty) {
      return html`
        ${notes}
        ${this._renderEmptyState(
          this._renderAddMenu([
            { label: 'Button', run: () => this._addFooterButton() },
            { label: 'Component', run: () => this._setFooterMode(true) },
          ]),
        )}
      `;
    }
    if (cardMode) {
      return html`
        ${notes}
        <div class="split ${this._tabCollapsed ? 'pv-collapsed' : ''}">
          <div class="editor">
            ${areaField(
              'Card (markdown or JSON)',
              typeof footer?.card === 'string'
                ? footer.card
                : JSON.stringify(footer?.card ?? '', null, 2),
              (v) => this._setFooterCard(v),
            )}
          </div>
          ${this._renderPreview(
            html`${this._renderGhost('up')}
            ${this._previewEl('footer-card', {
              footer: { card: footer?.card ?? '', divider: false },
            })}`,
            true,
          )}
        </div>
      `;
    }
    const buttons = footer?.buttons ?? [];
    return html`
      ${notes}
      <div class="split ${this._tabCollapsed ? 'pv-collapsed' : ''}">
        <div class="editor">${this._renderSelectedForm()}</div>
        ${this._renderPreview(
          // Faded placeholders above stand in for content so the footer sits
          // pinned to the bottom, as it does live, not in a large empty box.
          html`${this._renderGhost('up')}
          ${this._previewEl('footer', {
            footer: { buttons, divider: footer?.divider ?? true },
          })}`,
          true,
        )}
      </div>
    `;
  }

  /**
   * Renders the edit-form header: the "Element Setting" title and the selected
   * element's type above the controls.
   */
  private _formHeader(typeLabel: string): TemplateResult {
    const c = this._selectedContainer();
    const atTop = !c || c.index <= 0;
    const atBottom = !c || c.index >= c.arr.length - 1;
    return html`
      <div class="form-head">
        <div class="form-title">Element Settings: ${typeLabel}</div>
        <div class="form-tools">
          <button
            class="tool"
            title="Move up"
            aria-label="Move up"
            ?disabled=${atTop}
            @click=${() => this._moveSelected(-1)}
          >
            <ha-icon icon="mdi:arrow-up"></ha-icon>
          </button>
          <button
            class="tool"
            title="Move down"
            aria-label="Move down"
            ?disabled=${atBottom}
            @click=${() => this._moveSelected(1)}
          >
            <ha-icon icon="mdi:arrow-down"></ha-icon>
          </button>
          <button
            class="tool"
            title="More"
            aria-label="More"
            @click=${(e: Event) => this._openElementMenu(e)}
          >
            <ha-icon icon="mdi:dots-vertical"></ha-icon>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Renders the selected element's overflow menu, fixed-positioned under its
   * trigger: expand/collapse for a category, "Test action" for an element with a
   * tap action, or a placeholder otherwise.
   */
  private _renderElementMenu(): TemplateResult | typeof nothing {
    const rect = this._elementMenuRect;
    if (!this._elementMenuOpen || !rect) {
      return nothing;
    }
    const sel = this._locate(this._selected);
    const category = sel?.kind === 'block' && sel.block.type === 'category' ? sel : null;
    return html`
      <div
        class="menu-scrim"
        @click=${() => {
          this._elementMenuOpen = false;
        }}
      ></div>
      <div
        class="add-menu"
        style="top: ${rect.bottom + 4}px; right: ${Math.max(8, window.innerWidth - rect.right)}px"
      >
        ${this._renderElementMenuItems(category)}
      </div>
    `;
  }

  /**
   * The overflow menu items for the current selection.
   */
  private _renderElementMenuItems(
    category: Extract<Selected, { kind: 'block' }> | null,
  ): TemplateResult {
    if (category) {
      const collapsed = this._previewCollapsedCats.has(this._idFor(category.block));
      return html`<button class="add-menu-item" @click=${() => this._toggleCategoryPreview()}>
        ${collapsed ? 'Expand' : 'Collapse'} Category
      </button>`;
    }
    if (this._actionable() && this.hass) {
      return html`<button class="add-menu-item" @click=${() => this._testAction()}>
        Test action
      </button>`;
    }
    return html`<p class="menu-empty">No actions yet.</p>`;
  }

  /**
   * Toggles whether the selected category is shown collapsed in the preview.
   */
  private _toggleCategoryPreview(): void {
    const sel = this._locate(this._selected);
    if (sel?.kind !== 'block' || sel.block.type !== 'category') {
      return;
    }
    const id = this._idFor(sel.block);
    const next = new Set(this._previewCollapsedCats);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this._previewCollapsedCats = next;
    this._elementMenuOpen = false;
  }

  /**
   * Renders the left-panel edit form for the selected element, with a delete
   * control, or a hint when nothing is selected in the current tab.
   */
  private _renderSelectedForm(): TemplateResult {
    const sel = this._locate(this._selected);
    if (!sel) {
      return html`<p class="hint">Select an element in the preview to edit it.</p>`;
    }
    if (sel.kind === 'footer') {
      return html`
        <div class="form">
          ${this._formHeader('Button')}
          ${footerButtonFields(
            sel.btn,
            (partial) => this._patchFooterButton(sel.index, partial),
            this._ctx(),
            this.hass,
          )}
          <button class="add-btn" @click=${() => this._addFooterButton()}>
            ＋ Add Button Next
          </button>
          <button
            class="add-btn danger"
            @click=${() => {
              this._removeFooterButton(sel.index);
              this._selected = null;
            }}
          >
            Delete Button
          </button>
        </div>
      `;
    }
    if (sel.kind === 'item') {
      const patch: Patch = (partial) =>
        this._patchItem(sel.region, sel.index, sel.itemIndex, partial);
      return html`
        <div class="form">
          ${this._formHeader('Item')}
          ${blockFields({ ...sel.item, type: 'item' }, patch, this._ctx(), this.hass)}
          <button class="add-btn" @click=${() => this._addItem(sel.region, sel.index)}>
            ＋ Add Sub-Item Below
          </button>
          <button
            class="add-btn danger"
            @click=${() => {
              this._removeItem(sel.region, sel.index, sel.itemIndex);
              this._selected = null;
            }}
          >
            Delete Item
          </button>
        </div>
      `;
    }
    const patch: Patch = (partial) => this._patchBlock(sel.region, sel.index, partial);
    // ItemBlock.type is optional (items in a category omit it), so default to
    // 'item' for the label of a top-level item.
    const typeLabel = titleCase(sel.block.type ?? 'item');
    return html`
      <div class="form">
        ${this._formHeader(typeLabel)} ${blockFields(sel.block, patch, this._ctx(), this.hass)}
        ${
          sel.block.type === 'category'
            ? html`<button class="add-btn" @click=${() => this._addItem(sel.region, sel.index)}>
                ＋ Add Sub-Item Below
              </button>`
            : nothing
        }
        ${this._renderAddMenu(this._typeItems(sel.region), '＋ Add Element Below', true)}
        <button
          class="add-btn danger"
          @click=${() => {
            this._removeBlock(sel.region, sel.index);
            this._selected = null;
          }}
        >
          Delete ${typeLabel}
        </button>
      </div>
    `;
  }

  /**
   * Returns the cached `<dashboard-sidebar preview>` for a region, rendering the
   * real component so the preview is exactly the live sidebar. Clicks select and
   * drags reorder (wired via the preview's own events); the config is re-applied
   * only when it changes so live cards are not re-instantiated on every
   * keystroke, while the selection and collapse state track every render.
   */
  private _previewEl(key: string, config: DashboardSidebarConfig): DashboardSidebar {
    let el = this._previews.get(key);
    if (!el) {
      el = document.createElement('dashboard-sidebar') as DashboardSidebar;
      el.preview = true;
      // Set the attribute up front too, so the sidebar's :host([preview])
      // compacting rules apply on the very first paint (not a reflection later).
      el.setAttribute('preview', '');
      el.addEventListener(PREVIEW_SELECT_EVENT, (ev: Event) => {
        this._onPreviewSelect((ev as CustomEvent<{ loc: string }>).detail.loc);
      });
      el.addEventListener(PREVIEW_REORDER_EVENT, (ev: Event) => {
        this._applyReorder(
          (ev as CustomEvent<{ from: string; to: string; oldIndex?: number; newIndex?: number }>)
            .detail,
        );
      });
      this._previews.set(key, el);
    }
    el.hass = this.hass;
    el.previewCollapsed = this._tabCollapsed;
    el.previewSelected = this._selectedLoc();
    el.previewCollapsedCats = this._collapsedCatLocs();
    const json = JSON.stringify(config);
    if (this._previewCfg.get(el) !== json) {
      el.setConfig(config);
      this._previewCfg.set(el, json);
    }
    return el;
  }

  /**
   * Renders an add trigger: a dashed "+ Add Element" button (just "+" while
   * collapsed) that opens a menu of the given choices, so the trigger label is
   * never listed as a choice the way a native select's placeholder would be.
   */
  private _renderAddMenu(
    items: Array<{ label: string; run: () => void }>,
    label?: string,
    solid = false,
  ): TemplateResult {
    return html`
      <button
        class="add ${solid ? 'solid' : ''}"
        title="Add element"
        aria-label="Add element"
        @click=${(e: Event) => {
          e.stopPropagation();
          this._addMenuRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          this._addMenuItems = items;
          this._addMenuOpen = true;
        }}
      >
        ${label ?? (this._tabCollapsed ? '＋' : '＋ Add Element')}
      </button>
    `;
  }

  /**
   * Builds the add-menu choices for a region's block types.
   */
  private _typeItems(region: Region): Array<{ label: string; run: () => void }> {
    const types = region === 'header' ? ALL_TYPES : ALL_TYPES.filter((t) => t !== 'title');
    return types.map((t) => ({ label: titleCase(t), run: () => this._addBlock(region, t) }));
  }

  /**
   * Renders the add menu, fixed-positioned under its trigger so it escapes the
   * modal's clipping.
   */
  private _renderAddMenuPopup(): TemplateResult | typeof nothing {
    const rect = this._addMenuRect;
    if (!this._addMenuOpen || !rect) {
      return nothing;
    }
    return html`
      <div
        class="menu-scrim"
        @click=${() => {
          this._addMenuOpen = false;
        }}
      ></div>
      <div class="add-menu" style="top: ${rect.bottom + 4}px; left: ${Math.max(8, rect.left)}px">
        ${this._addMenuItems.map(
          (item) =>
            html`<button
              class="add-menu-item"
              @click=${() => {
                item.run();
                this._addMenuOpen = false;
              }}
            >
              ${item.label}
            </button>`,
        )}
      </div>
    `;
  }

  /** Styles for the editor modal. */
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 100;
      /* Center via flexbox rather than a transform on the panel: a transformed
         ancestor would become the containing block for the preview's
         fixed-position popovers and tooltips, throwing off their placement. */
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--ha-font-family-body, sans-serif);
      color: var(--primary-text-color, #212121);

      /* A subtly distinct surface shared by the active tab and the content
         area, so the two read as one region against the modal background. */
      --dsb-surface: color-mix(in srgb, var(--primary-text-color, #212121) 6%, transparent);
    }

    /* No focus/selection outlines on the modal's own controls. */
    :focus,
    :focus-visible {
      outline: none;
    }

    .backdrop {
      position: absolute;
      inset: 0;
      background: rgb(0 0 0 / 45%);
    }

    .panel {
      position: relative;
      z-index: 1;
      width: min(640px, 94vw);
      height: 75vh;
      display: flex;
      flex-direction: column;
      /* Composite the (often translucent) card color over an opaque base so the
         dashboard never shows through the modal, plus the surface tint on top so
         the modal is the tinted colour and the tab/content area is the base. */
      background-color: var(--primary-background-color, #fff);
      background-image:
        linear-gradient(var(--dsb-surface), var(--dsb-surface)),
        linear-gradient(var(--card-background-color, #fff), var(--card-background-color, #fff));
      border-radius: 12px;
      box-shadow: 0 8px 40px rgb(0 0 0 / 40%);
      overflow: hidden;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 12px 2px;
    }

    header h2 {
      margin: 0;
      font-size: 1.4rem;
      font-weight: 600;
    }

    .content {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      padding: 12px;
      /* Clip here; the columns inside scroll independently. */
      overflow: hidden;
      background-color: var(--primary-background-color, #fff);
      background-image: linear-gradient(
        var(--card-background-color, #fff),
        var(--card-background-color, #fff)
      );
    }

    .tabs {
      display: flex;
      gap: 4px;
      padding: 2px 12px 0;
      flex-wrap: wrap;
    }

    .tab {
      font: inherit;
      padding: 6px 12px;
      border: none;
      border-radius: 8px 8px 0 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      opacity: 0.7;
    }

    .tab.active {
      background-color: var(--primary-background-color, #fff);
      background-image: linear-gradient(
        var(--card-background-color, #fff),
        var(--card-background-color, #fff)
      );
      opacity: 1;
      font-weight: 600;
    }

    .settings {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
    }

    .icon-choice {
      display: flex;
      gap: 6px;
    }

    .choice {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 8px 18px;
      border: 1px solid var(--divider-color, rgb(0 0 0 / 20%));
      border-radius: 8px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    .choice ha-icon {
      --mdc-icon-size: 24px;
    }

    .choice-label {
      font-size: 0.75rem;
    }

    .choice.sel {
      background: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
      border-color: transparent;
    }

    .advanced {
      margin-top: 4px;
    }

    .advanced summary {
      cursor: pointer;
      font-size: 0.8rem;
      opacity: 0.7;
      margin-bottom: 4px;
    }

    .region {
      margin-bottom: 16px;
    }

    /* Two equal halves at a constant modal width; the layout never reflows when
       the preview collapses. Stacks on mobile via the media query below. */
    .split {
      display: flex;
      gap: 20px;
      align-items: stretch;
      flex: 1 1 auto;
      min-height: 0;
    }

    .editor,
    .preview {
      flex: 1 1 0;
      min-width: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .editor {
      gap: 10px;
      /* Scrolls independently of the preview. Inset the content on the right so
         an overlay scrollbar (macOS "show when scrolling") sits clear of the
         form controls instead of over them, plus a thin styled bar. */
      overflow-y: auto;
      padding-right: 12px;
      scrollbar-width: thin;
      scrollbar-color: var(--divider-color, rgb(0 0 0 / 30%)) transparent;
    }

    .editor::-webkit-scrollbar {
      width: 6px;
    }

    .editor::-webkit-scrollbar-thumb {
      border-radius: 3px;
      background: var(--divider-color, rgb(0 0 0 / 30%));
    }

    .editor::-webkit-scrollbar-track {
      background: transparent;
    }

    /* Collapsed (non-mobile): the editor grows to fill and the preview shrinks
       to just what the icon strip needs, pinned to the modal's right edge. No
       flex-wrap, so it never drops below. */
    .split.pv-collapsed .editor {
      flex: 1 1 auto;
    }

    .split.pv-collapsed .preview {
      flex: 0 0 auto;
    }

    .split.pv-collapsed .preview-head {
      justify-content: flex-end;
      gap: 8px;
    }

    .preview-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .preview-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.6;
    }

    .pv-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      opacity: 0.7;
    }

    .pv-toggle:hover {
      opacity: 1;
      background: var(--secondary-background-color, rgb(0 0 0 / 6%));
    }

    .pv-toggle ha-icon {
      --mdc-icon-size: 18px;
    }

    .pv-frame {
      box-sizing: border-box;
      /* A little vertical room so the first/last element's selection outline is
         not clipped by the scroll container's edge. */
      padding: 4px 0;
      border: 1px solid var(--divider-color, rgb(0 0 0 / 15%));
      background: var(--card-background-color, #fff);
      /* Fill the preview height and scroll on its own, below the fixed heading. */
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      /* Thin, overlaid scrollbar so it does not take width from the content. */
      scrollbar-width: thin;
      scrollbar-color: var(--divider-color, rgb(0 0 0 / 30%)) transparent;
    }

    .pv-frame::-webkit-scrollbar {
      width: 6px;
    }

    .pv-frame::-webkit-scrollbar-thumb {
      border-radius: 3px;
      background: var(--divider-color, rgb(0 0 0 / 30%));
    }

    .pv-frame::-webkit-scrollbar-track {
      background: transparent;
    }

    /* Collapsed preview: narrow to the icon-strip width, pinned to the right
       edge of the (content-sized) preview column. */
    .pv-frame.collapsed {
      width: 76px;
      align-self: flex-end;
    }

    /* Column frame used by the header/footer previews so the region can be
       pinned to one edge with a faded placeholder filling the rest. */
    .pv-frame.pv-col {
      display: flex;
      flex-direction: column;
    }

    /* Skeleton placeholder rows standing in for the content beside a pinned
       region, faded out toward the far edge. */
    .pv-ghost {
      flex: 1 1 auto;
      min-height: 48px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 10px 16px;
      overflow: hidden;
      pointer-events: none;
    }

    .pv-ghost.fade-up {
      justify-content: flex-end;
      mask-image: linear-gradient(to top, #000 15%, transparent 95%);
    }

    .pv-ghost.fade-down {
      justify-content: flex-start;
      mask-image: linear-gradient(to bottom, #000 15%, transparent 95%);
    }

    .ghost-row {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 10px;
    }

    .ghost-icon {
      flex: 0 0 auto;
      width: 22px;
      height: 22px;
      border-radius: 6px;
      background: var(--divider-color, rgb(0 0 0 / 15%));
    }

    .ghost-bar {
      height: 12px;
      border-radius: 6px;
      background: var(--divider-color, rgb(0 0 0 / 15%));
    }

    /* The region preview renders at its natural height instead of filling the
       frame, so a short region does not stretch. */
    .pv-frame dashboard-sidebar {
      display: block;
      height: auto;
    }

    @media (width < 640px) {
      /* Full-screen modal on mobile. */
      .panel {
        width: 100vw;
        height: 100vh;
        border-radius: 0;
      }

      /* Stacked: scroll the whole content as one instead of per-column. */
      .content {
        overflow-y: auto;
      }

      .split {
        flex-direction: column;
        flex: 0 0 auto;
      }

      .editor,
      .preview,
      .pv-frame {
        width: 100%;
        flex: 0 0 auto;
      }

      .editor,
      .pv-frame {
        overflow: visible;
      }
    }

    .form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* The form header row: the element-setting label plus the move/overflow
       tools aligned to the right. */
    .form-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    /* Matches the PREVIEW label so the two columns' headers read as a pair. */
    .form-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.6;
    }

    .form-tools {
      display: flex;
      align-items: center;
      gap: 2px;
      flex: 0 0 auto;
    }

    .tool {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    .tool:hover:not([disabled]) {
      background: var(--secondary-background-color, rgb(0 0 0 / 8%));
    }

    .tool[disabled] {
      opacity: 0.3;
      cursor: default;
    }

    .tool ha-icon {
      --mdc-icon-size: 18px;
    }

    .menu-empty {
      margin: 0;
      padding: 8px 12px;
      opacity: 0.6;
      font-size: 0.85rem;
    }

    /* Borderless call-to-action shown instead of a preview when a region has no
       elements, so an empty area is not made to look as if it renders. */
    .empty-state {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      padding: 32px 16px;
      text-align: center;
    }

    .empty-msg {
      margin: 0;
      max-width: 32ch;
      opacity: 0.7;
    }

    .danger {
      color: var(--error-color, #db4437);
    }

    .icon {
      border: none;
      background: transparent;
      color: inherit;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 6px;
      font: inherit;
    }

    .icon:hover:not([disabled]) {
      background: var(--divider-color, rgb(0 0 0 / 10%));
    }

    .icon[disabled] {
      opacity: 0.3;
      cursor: default;
    }

    .icon.danger:hover {
      color: var(--error-color, #db4437);
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 0.85rem;
    }

    .field-inline {
      flex-direction: row;
      align-items: flex-start;
      gap: 8px;
    }

    .check-label {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .field-desc {
      font-size: 0.75rem;
      opacity: 0.6;
      line-height: 1.3;
    }

    .color-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .color-row input[type='text'] {
      flex: 1;
      min-width: 0;
    }

    .color-swatch {
      width: 40px;
      height: 34px;
      flex: 0 0 auto;
      padding: 2px;
      border: 1px solid var(--divider-color, rgb(0 0 0 / 20%));
      border-radius: 6px;
      cursor: pointer;
    }

    .field input[type='text'],
    .field select,
    .field textarea {
      box-sizing: border-box;
      width: 100%;
      font: inherit;
      padding: 6px 8px;
      border: 1px solid var(--divider-color, rgb(0 0 0 / 20%));
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: inherit;
    }

    .field.invalid input[type='text'],
    .field.invalid textarea {
      border-color: var(--error-color, #db4437);
    }

    /* HA's code editor field: wrap it in the same bordered box as the other
       inputs so its inline autocomplete matches the form. */
    .code-field ha-code-editor {
      display: block;
      border: 1px solid var(--divider-color, rgb(0 0 0 / 20%));
      border-radius: 6px;
      overflow: hidden;
      --code-editor-background-color: var(--card-background-color, transparent);
      --code-mirror-max-height: 160px;
    }

    .code-field.invalid ha-code-editor {
      border-color: var(--error-color, #db4437);
    }

    .field-error {
      color: var(--error-color, #db4437);
      font-size: 0.75rem;
    }

    .hint {
      font-size: 0.8rem;
      opacity: 0.6;
      margin: 4px 0;
    }

    .tab-notes {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--divider-color, rgb(0 0 0 / 15%));
    }

    .tab-notes .tab-note {
      flex: 1 1 auto;
    }

    .tab-note {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.4;
      opacity: 0.85;
    }

    .editor-note {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin: 0 0 12px;
      padding: 10px 12px;
      border: 1px solid var(--divider-color, rgb(0 0 0 / 15%));
      border-left: 3px solid var(--info-color, #2196f3);
      border-radius: 8px;
      background: color-mix(in srgb, var(--info-color, #2196f3) 8%, transparent);
      font-size: 0.95rem;
      line-height: 1.4;
    }

    .editor-note ha-icon {
      --mdc-icon-size: 22px;

      flex: 0 0 auto;
      color: var(--info-color, #2196f3);
    }

    /* Dashed "dropzone" add trigger, used for empty-area call-to-actions. */
    .add {
      font: inherit;
      margin-top: 4px;
      padding: 6px 10px;
      border: 1px dashed var(--divider-color, rgb(0 0 0 / 25%));
      border-radius: 8px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    /* Normal (solid) form action buttons: add-below, add sub-item, delete. */
    .add-btn,
    .add.solid {
      font: inherit;
      margin-top: 4px;
      padding: 8px 12px;
      border: 1px solid var(--divider-color, rgb(0 0 0 / 25%));
      border-radius: 8px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    .add-btn:hover,
    .add.solid:hover {
      background: var(--secondary-background-color, rgb(0 0 0 / 6%));
    }

    .add-btn.danger:hover {
      background: color-mix(in srgb, var(--error-color, #db4437) 12%, transparent);
    }

    .errors {
      margin: 0;
      padding: 8px 24px;
      color: var(--error-color, #db4437);
      font-size: 0.8rem;
      background: color-mix(in srgb, var(--error-color, #db4437) 10%, transparent);
    }

    footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 10px 12px;
    }

    footer button {
      font: inherit;
      padding: 8px 16px;
      border: 1px solid var(--divider-color, rgb(0 0 0 / 20%));
      border-radius: 8px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    .primary {
      background: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
      border-color: transparent;
    }

    .primary[disabled] {
      opacity: 0.45;
      cursor: default;
    }

    .confirm-scrim {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgb(0 0 0 / 45%);
      border-radius: 12px;
    }

    .confirm {
      max-width: 320px;
      margin: 16px;
      padding: 16px;
      border-radius: 12px;
      background-color: var(--primary-background-color, #fff);
      background-image: linear-gradient(
        var(--card-background-color, #fff),
        var(--card-background-color, #fff)
      );
      box-shadow: 0 8px 40px rgb(0 0 0 / 40%);
    }

    .confirm p {
      margin: 0 0 14px;
    }

    .confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .confirm-actions button {
      font: inherit;
      padding: 8px 14px;
      border: 1px solid var(--divider-color, rgb(0 0 0 / 20%));
      border-radius: 8px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    .danger-btn {
      background: var(--error-color, #db4437);
      color: var(--text-primary-color, #fff);
      border-color: transparent;
    }

    /* Custom add-element type menu (fixed so it escapes the modal clipping). */
    .menu-scrim {
      position: fixed;
      inset: 0;
      z-index: 1;
    }

    .add-menu {
      position: fixed;
      z-index: 2;
      display: flex;
      flex-direction: column;
      width: max-content;
      min-width: 150px;
      height: min-content;
      max-height: 60vh;
      overflow-y: auto;
      padding: 4px;
      border: 1px solid var(--divider-color, rgb(0 0 0 / 15%));
      border-radius: 8px;
      background-color: var(--primary-background-color, #fff);
      background-image: linear-gradient(
        var(--card-background-color, #fff),
        var(--card-background-color, #fff)
      );
      box-shadow: 0 4px 16px rgb(0 0 0 / 40%);
    }

    .add-menu-item {
      font: inherit;
      text-align: left;
      padding: 8px 12px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    .add-menu-item:hover {
      background: var(--secondary-background-color, rgb(0 0 0 / 8%));
    }
  `;
}

declare global {
  /** Registers the editor tag name for typed DOM lookups. */
  interface HTMLElementTagNameMap {
    /** The dashboard sidebar editor element. */
    'dashboard-sidebar-editor': DashboardSidebarEditor;
  }
}
