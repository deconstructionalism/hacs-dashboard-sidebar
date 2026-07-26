import type { HomeAssistant, LovelaceCardConfig } from 'custom-card-helpers';
import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

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
import { validateConfig } from '../lib/validate';
import { defaultBlock, defaultFooterButton } from './arrange';
import { makeSortable } from './sortable';
import {
  areaField,
  blockFields,
  checkboxField,
  footerButtonFields,
  iconChoiceField,
  intField,
  type Patch,
  textField,
  titleCase,
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

  /** Validation errors from the last save attempt. */
  @state() private _errors: string[] = [];

  /** The mutable working copy of the config. */
  private _working: DashboardSidebarConfig = {};

  /** Stable ids per row object, for keyed rendering under drag-and-drop. */
  private readonly _ids = new WeakMap<object, string>();

  /** Monotonic counter backing the id map. */
  private _idSeq = 0;

  /** Row containers already wired for drag-and-drop. */
  private readonly _sorted = new WeakSet<HTMLElement>();

  /** Cached live preview elements, keyed by the row object's stable id. */
  private readonly _previews = new Map<string, DashboardSidebar>();

  /** Last config serialized into each preview, to skip redundant rebuilds. */
  private readonly _previewCfg = new WeakMap<DashboardSidebar, string>();

  /**
   * Clones the incoming config into the working copy.
   */
  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('config')) {
      this._working = this.config ? (structuredClone(this.config) as DashboardSidebarConfig) : {};
    }
  }

  /**
   * Wires drag-and-drop on any row list not already handled.
   */
  protected updated(): void {
    this.renderRoot.querySelectorAll<HTMLElement>('[data-sort]').forEach((el) => {
      if (!this._sorted.has(el)) {
        this._sorted.add(el);
        const handle = el.classList.contains('pv-sublist') ? '.idrag' : '.drag';
        makeSortable(el, (from, to) => this._onSort(el.dataset.sort ?? '', from, to), handle);
      }
    });
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
   * Moves an element within an array from one index to another.
   */
  private _reorder(arr: unknown[] | undefined, from: number, to: number): void {
    if (arr && from >= 0 && from < arr.length && to >= 0 && to < arr.length) {
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
    }
  }

  /**
   * Handles a drag-drop reorder for the identified list.
   */
  private _onSort(key: string, from?: number, to?: number): void {
    if (from === undefined || to === undefined || from === to) {
      return;
    }
    if (key === 'header' || key === 'body') {
      this._reorder(this._working[key], from, to);
    } else if (key === 'footer') {
      this._reorder(this._working.footer?.buttons, from, to);
    } else if (key.startsWith('cat:')) {
      const [, region, index] = key.split(':');
      this._reorder(this._category(region as Region, Number(index))?.items, from, to);
    }
    this._touch();
  }

  /**
   * Selects an element for editing, stopping the click from bubbling to a
   * parent selectable (e.g. a category behind one of its items).
   */
  private _select(ev: Event, id: string): void {
    ev.stopPropagation();
    this._selected = id;
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
    list.push(block);
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
   * Appends a new item to a category.
   */
  private _addItem(region: Region, index: number): void {
    const item = defaultBlock('item') as ItemBlock;
    this._category(region, index)?.items.push(item);
    this._selected = this._idFor(item);
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
   * Switches the footer between button and custom-component mode.
   */
  private _setFooterMode(card: boolean): void {
    this._working.footer = card ? { card: '' } : { buttons: [] };
    this._touch();
  }

  /**
   * Appends a new footer button.
   */
  private _addFooterButton(): void {
    const footer = this._working.footer ?? (this._working.footer = {});
    const btn = defaultFooterButton();
    (footer.buttons ?? (footer.buttons = [])).push(btn);
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
    this._working.footer = { card };
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
   * Closes without saving.
   */
  private _close(): void {
    this.onClose?.();
  }

  /**
   * Renders the modal shell: the three sections, errors, and actions.
   */
  protected render(): TemplateResult {
    return html`
      <div class="backdrop" @click=${this._close}></div>
      <div class="panel" role="dialog" aria-label="Edit sidebar">
        <header>
          <h2>Edit sidebar</h2>
          <button class="icon" title="Close" @click=${this._close}>✕</button>
        </header>
        <div class="tabs">
          ${TABS.map(
            (t) => html`
              <button
                class="tab ${this._tab === t.id ? 'active' : ''}"
                @click=${() => {
                  this._tab = t.id;
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
          <button class="primary" @click=${this._save}>Save</button>
        </footer>
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
          'Position',
          c.position ?? 'left',
          [
            { value: 'left', icon: 'mdi:page-layout-sidebar-left', title: 'Left' },
            { value: 'right', icon: 'mdi:page-layout-sidebar-right', title: 'Right' },
          ],
          (v) => this._patchConfig({ position: v }),
        )}
        ${intField('Width (px)', c.width, (v) => this._patchConfig({ width: v }))}
        ${checkboxField('Start collapsed', c.start_collapsed ?? false, (v) =>
          this._patchConfig({ start_collapsed: v }),
        )}
        ${checkboxField('Hide on mobile', c.hide_on_mobile ?? false, (v) =>
          this._patchConfig({ hide_on_mobile: v }),
        )}
        ${textField('Background (CSS color)', c.background, (v) =>
          this._patchConfig({ background: v || undefined }),
        )}
      </section>
    `;
  }

  /**
   * Renders a region (header or body) as a two-column split: the edit panel on
   * the left, the live, drag-reorderable preview on the right.
   */
  private _renderSplit(region: Region): TemplateResult {
    const types = region === 'header' ? ALL_TYPES : ALL_TYPES.filter((t) => t !== 'title');
    return html`
      <div class="split">
        <div class="editor">
          ${this._renderAddMenu(types, (type) => this._addBlock(region, type))}
          ${this._renderSelectedForm()}
        </div>
        <div class="preview">${this._renderRegionPreview(region)}</div>
      </div>
    `;
  }

  /**
   * Renders the live preview list for a region: one selectable, draggable node
   * per block, with a nested item list for each category.
   */
  private _renderRegionPreview(region: Region): TemplateResult {
    const blocks = this._working[region] ?? [];
    return html`
      <div class="pv-list" data-sort=${region}>
        ${repeat(
          blocks,
          (block) => this._idFor(block),
          (block, i) => this._renderPreviewNode(region, i, block),
        )}
      </div>
      ${
        blocks.length === 0
          ? html`<p class="hint">No elements yet — use “Add element”.</p>`
          : nothing
      }
    `;
  }

  /**
   * Renders one preview node: a selectable, draggable block, plus a nested
   * draggable item list when the block is a category.
   */
  private _renderPreviewNode(region: Region, index: number, block: SidebarBlock): TemplateResult {
    const id = this._idFor(block);
    if (block.type !== 'category') {
      return html`
        <div
          class="pv-node ${this._selected === id ? 'sel' : ''}"
          data-id=${id}
          @click=${(e: Event) => this._select(e, id)}
        >
          <span class="drag" title="Drag to reorder">⣿</span>
          <div class="pv-body">${this._renderBlockPreview(block)}</div>
        </div>
      `;
    }
    return html`
      <div class="pv-node pv-cat">
        <div
          class="pv-cat-head ${this._selected === id ? 'sel' : ''}"
          data-id=${id}
          @click=${(e: Event) => this._select(e, id)}
        >
          <span class="drag" title="Drag to reorder">⣿</span>
          <div class="pv-body">${this._renderBlockPreview(block)}</div>
        </div>
        <div class="pv-sublist" data-sort=${`cat:${region}:${index}`}>
          ${repeat(
            block.items,
            (item) => this._idFor(item),
            (item) => this._renderPreviewItem(item),
          )}
        </div>
      </div>
    `;
  }

  /**
   * Renders one selectable, draggable category-item node.
   */
  private _renderPreviewItem(item: ItemBlock): TemplateResult {
    const id = this._idFor(item);
    return html`
      <div
        class="pv-node pv-subnode ${this._selected === id ? 'sel' : ''}"
        data-id=${id}
        @click=${(e: Event) => this._select(e, id)}
      >
        <span class="idrag" title="Drag to reorder">⣿</span>
        <div class="pv-body">${this._renderItemPreview(item)}</div>
      </div>
    `;
  }

  /**
   * Renders the footer tab: a mode toggle and, per mode, the button editor or
   * the card field, each split into edit controls and a live preview.
   */
  private _renderFooterTab(): TemplateResult {
    const footer = this._working.footer;
    const cardMode = footer?.card !== undefined;
    const modes = html`
      <div class="modes">
        <button class="mode ${cardMode ? '' : 'sel'}" @click=${() => this._setFooterMode(false)}>
          Buttons
        </button>
        <button class="mode ${cardMode ? 'sel' : ''}" @click=${() => this._setFooterMode(true)}>
          Component
        </button>
      </div>
    `;
    if (cardMode) {
      return html`
        <div class="split">
          <div class="editor">
            ${modes}
            ${areaField(
              'Card (markdown or JSON)',
              typeof footer?.card === 'string'
                ? footer.card
                : JSON.stringify(footer?.card ?? '', null, 2),
              (v) => this._setFooterCard(v),
            )}
          </div>
          <div class="preview">
            ${this._previewEl('footer-card', {
              footer: { card: footer?.card ?? '', divider: false },
            })}
          </div>
        </div>
      `;
    }
    const buttons = footer?.buttons ?? [];
    return html`
      <div class="split">
        <div class="editor">
          ${modes}
          <button class="add-btn" @click=${() => this._addFooterButton()}>＋ Add button</button>
          ${this._renderSelectedForm()}
        </div>
        <div class="preview">
          <div class="pv-list" data-sort="footer">
            ${repeat(
              buttons,
              (btn) => this._idFor(btn),
              (btn) => this._renderFooterNode(btn),
            )}
          </div>
          ${buttons.length === 0 ? html`<p class="hint">No buttons yet.</p>` : nothing}
        </div>
      </div>
    `;
  }

  /**
   * Renders one selectable, draggable footer-button node.
   */
  private _renderFooterNode(btn: FooterButtonConfig): TemplateResult {
    const id = this._idFor(btn);
    return html`
      <div
        class="pv-node ${this._selected === id ? 'sel' : ''}"
        data-id=${id}
        @click=${(e: Event) => this._select(e, id)}
      >
        <span class="drag" title="Drag to reorder">⣿</span>
        <div class="pv-body">${this._renderFooterButtonPreview(btn)}</div>
      </div>
    `;
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
          ${footerButtonFields(sel.btn, (partial) => this._patchFooterButton(sel.index, partial))}
          <button
            class="add-btn danger"
            @click=${() => {
              this._removeFooterButton(sel.index);
              this._selected = null;
            }}
          >
            Delete button
          </button>
        </div>
      `;
    }
    if (sel.kind === 'item') {
      const patch: Patch = (partial) =>
        this._patchItem(sel.region, sel.index, sel.itemIndex, partial);
      return html`
        <div class="form">
          ${blockFields({ ...sel.item, type: 'item' }, patch)}
          <button
            class="add-btn danger"
            @click=${() => {
              this._removeItem(sel.region, sel.index, sel.itemIndex);
              this._selected = null;
            }}
          >
            Delete item
          </button>
        </div>
      `;
    }
    const patch: Patch = (partial) => this._patchBlock(sel.region, sel.index, partial);
    return html`
      <div class="form">
        ${blockFields(sel.block, patch)}
        ${
          sel.block.type === 'category'
            ? html`<button class="add-btn" @click=${() => this._addItem(sel.region, sel.index)}>
                ＋ Add item
              </button>`
            : nothing
        }
        <button
          class="add-btn danger"
          @click=${() => {
            this._removeBlock(sel.region, sel.index);
            this._selected = null;
          }}
        >
          Delete element
        </button>
      </div>
    `;
  }

  /**
   * Returns a cached, inert `<dashboard-sidebar preview>` for a row, rebuilt only
   * when its single-block config changes so live cards are not re-instantiated on
   * every keystroke.
   */
  private _previewEl(id: string, config: DashboardSidebarConfig): DashboardSidebar {
    let el = this._previews.get(id);
    if (!el) {
      el = document.createElement('dashboard-sidebar') as DashboardSidebar;
      el.preview = true;
      this._previews.set(id, el);
    }
    el.hass = this.hass;
    const key = JSON.stringify(config);
    if (this._previewCfg.get(el) !== key) {
      el.setConfig(config);
      this._previewCfg.set(el, key);
    }
    return el;
  }

  /**
   * Renders a live preview of a block as currently set, using the real sidebar
   * element so templates, clocks, cards, and icons all resolve.
   */
  private _renderBlockPreview(block: SidebarBlock): DashboardSidebar {
    const config: DashboardSidebarConfig =
      block.type === 'category' ? { body: [{ ...block, items: [] }] } : { body: [block] };
    return this._previewEl(this._idFor(block), config);
  }

  /**
   * Renders a live preview of a category item as a single-item sidebar row.
   */
  private _renderItemPreview(item: ItemBlock): DashboardSidebar {
    return this._previewEl(this._idFor(item), { body: [{ ...item, type: 'item' }] });
  }

  /**
   * Renders a live preview of a footer button as a divider-less footer.
   */
  private _renderFooterButtonPreview(btn: FooterButtonConfig): DashboardSidebar {
    return this._previewEl(this._idFor(btn), { footer: { buttons: [btn], divider: false } });
  }

  /**
   * Renders an "+ Add" dropdown that inserts a block of the chosen type.
   */
  private _renderAddMenu(types: BlockType[], onPick: (type: BlockType) => void): TemplateResult {
    return html`
      <select
        class="add"
        @change=${(e: Event) => {
          const sel = e.target as HTMLSelectElement;
          if (sel.value) {
            onPick(sel.value as BlockType);
            sel.value = '';
          }
        }}
      >
        <option value="">＋ Add element…</option>
        ${types.map((t) => html`<option value=${t}>${titleCase(t)}</option>`)}
      </select>
    `;
  }

  /** Styles for the editor modal. */
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 100;
      font-family: var(--ha-font-family-body, sans-serif);
      color: var(--primary-text-color, #212121);

      /* A subtly distinct surface shared by the active tab and the content
         area, so the two read as one region against the modal background. */
      --dsb-surface: color-mix(in srgb, var(--primary-text-color, #212121) 6%, transparent);
    }

    .backdrop {
      position: absolute;
      inset: 0;
      background: rgb(0 0 0 / 45%);
    }

    .panel {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: min(900px, 94vw);
      max-height: 88vh;
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
      padding: 10px 12px;
    }

    header h2 {
      margin: 0;
      font-size: 1rem;
    }

    .content {
      padding: 12px;
      overflow-y: auto;
      background-color: var(--primary-background-color, #fff);
      background-image: linear-gradient(
        var(--card-background-color, #fff),
        var(--card-background-color, #fff)
      );
    }

    .tabs {
      display: flex;
      gap: 4px;
      padding: 8px 12px 0;
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
    }

    .icon-choice {
      display: flex;
      gap: 6px;
    }

    .choice {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px 14px;
      border: 1px solid var(--divider-color, rgb(0 0 0 / 20%));
      border-radius: 8px;
      background: transparent;
      color: inherit;
      cursor: pointer;
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

    .split {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }

    .editor {
      flex: 1 1 42%;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .preview {
      flex: 1 1 58%;
      min-width: 0;
      padding: 8px;
      border: 1px solid var(--divider-color, rgb(0 0 0 / 15%));
      border-radius: 10px;
      background: var(--card-background-color, #fff);
    }

    @media (width < 640px) {
      .split {
        flex-direction: column;
      }

      .editor,
      .preview {
        width: 100%;
      }
    }

    .form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .pv-list,
    .pv-sublist,
    .pv-cat {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .pv-sublist {
      margin-left: 16px;
    }

    .drag,
    .idrag {
      cursor: grab;
      opacity: 0.4;
      user-select: none;
    }

    .pv-node,
    .pv-cat-head {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 4px;
      border: 2px solid transparent;
      border-radius: 8px;
      cursor: pointer;
    }

    .pv-cat {
      padding: 0;
      border: none;
      cursor: default;
    }

    .pv-node:hover,
    .pv-cat-head:hover {
      background: var(--secondary-background-color, rgb(0 0 0 / 4%));
    }

    .pv-node.sel,
    .pv-cat-head.sel {
      border-color: var(--primary-color, #03a9f4);
      background: color-mix(in srgb, var(--primary-color, #03a9f4) 12%, transparent);
    }

    .pv-body {
      flex: 1;
      min-width: 0;
      pointer-events: none;
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
      align-items: center;
      gap: 6px;
    }

    .field input[type='text'],
    .field select,
    .field textarea {
      font: inherit;
      padding: 6px 8px;
      border: 1px solid var(--divider-color, rgb(0 0 0 / 20%));
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: inherit;
    }

    .hint {
      font-size: 0.8rem;
      opacity: 0.6;
      margin: 4px 0;
    }

    .add,
    .add-btn {
      font: inherit;
      margin-top: 4px;
      padding: 6px 10px;
      border: 1px dashed var(--divider-color, rgb(0 0 0 / 25%));
      border-radius: 8px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    .modes {
      display: flex;
      gap: 4px;
    }

    .mode {
      font: inherit;
      padding: 4px 12px;
      border: 1px solid var(--divider-color, rgb(0 0 0 / 20%));
      border-radius: 8px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    .mode.sel {
      background: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
      border-color: transparent;
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
  `;
}

declare global {
  /** Registers the editor tag name for typed DOM lookups. */
  interface HTMLElementTagNameMap {
    /** The dashboard sidebar editor element. */
    'dashboard-sidebar-editor': DashboardSidebarEditor;
  }
}
