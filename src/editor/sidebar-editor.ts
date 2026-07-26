import type { HomeAssistant, LovelaceCardConfig } from 'custom-card-helpers';
import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type {
  BlockType,
  CategoryBlock,
  DashboardSidebarConfig,
  ItemBlock,
  Region,
  SidebarBlock,
} from '../lib/types';
import { validateConfig } from '../lib/validate';
import { defaultBlock, defaultFooterButton, moveBlock } from './arrange';
import { areaField, blockFields, blockSummary, footerButtonFields, type Patch } from './block-form';

/** Every block type, offered when adding to the header. */
const ALL_TYPES: BlockType[] = ['title', 'clock', 'date', 'divider', 'item', 'category', 'card'];

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

  /** Keys of rows expanded for field editing. */
  @state() private _expanded = new Set<string>();

  /** Validation errors from the last save attempt. */
  @state() private _errors: string[] = [];

  /** The mutable working copy of the config. */
  private _working: DashboardSidebarConfig = {};

  /**
   * Clones the incoming config into the working copy.
   */
  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('config')) {
      this._working = this.config ? (structuredClone(this.config) as DashboardSidebarConfig) : {};
    }
  }

  /**
   * Re-renders after an in-place mutation of the working copy.
   */
  private _touch(): void {
    this.requestUpdate();
  }

  /**
   * Toggles whether a row is expanded for field editing.
   */
  private _toggleExpand(key: string): void {
    const next = new Set(this._expanded);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this._expanded = next;
  }

  /**
   * Appends a new block of the given type to a region.
   */
  private _addBlock(region: Region, type: BlockType): void {
    const list = this._working[region] ?? (this._working[region] = []);
    list.push(defaultBlock(type));
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
   * Reorders a block within its region by the given step.
   */
  private _moveBlock(region: Region, index: number, delta: number): void {
    Object.assign(
      this._working,
      moveBlock(this._working, { region, index }, { region, index: index + delta }),
    );
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
    this._category(region, index)?.items.push(defaultBlock('item') as ItemBlock);
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
   * Reorders an item within a category by the given step.
   */
  private _moveItem(region: Region, index: number, itemIndex: number, delta: number): void {
    const items = this._category(region, index)?.items;
    const to = itemIndex + delta;
    if (items && to >= 0 && to < items.length) {
      [items[itemIndex], items[to]] = [items[to], items[itemIndex]];
      this._touch();
    }
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
    (footer.buttons ?? (footer.buttons = [])).push(defaultFooterButton());
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
   * Reorders a footer button by the given step.
   */
  private _moveFooterButton(index: number, delta: number): void {
    const buttons = this._working.footer?.buttons;
    const to = index + delta;
    if (buttons && to >= 0 && to < buttons.length) {
      [buttons[index], buttons[to]] = [buttons[to], buttons[index]];
      this._touch();
    }
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
        <div class="content">
          ${this._renderSection('header')} ${this._renderSection('body')} ${this._renderFooter()}
        </div>
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
   * Renders a block region (header or body) with its rows and add control.
   */
  private _renderSection(region: Region): TemplateResult {
    const blocks = this._working[region] ?? [];
    const types = region === 'header' ? ALL_TYPES : ALL_TYPES.filter((t) => t !== 'title');
    return html`
      <section class="region">
        <div class="region-head">
          <h3>${region}</h3>
          ${this._renderAddMenu(types, (type) => this._addBlock(region, type))}
        </div>
        <div class="rows">
          ${blocks.map((block, i) => this._renderRow(region, i, block, blocks.length))}
        </div>
      </section>
    `;
  }

  /**
   * Renders one block row: summary, controls, and expandable fields.
   */
  private _renderRow(
    region: Region,
    index: number,
    block: SidebarBlock,
    count: number,
  ): TemplateResult {
    const key = `${region}-${index}`;
    const expanded = this._expanded.has(key);
    return html`
      <div class="row">
        <span class="rtype">${block.type}</span>
        <span class="rsum">${blockSummary(block)}</span>
        ${this._renderControls(
          () => this._toggleExpand(key),
          () => this._moveBlock(region, index, -1),
          () => this._moveBlock(region, index, 1),
          () => this._removeBlock(region, index),
          index === 0,
          index === count - 1,
        )}
      </div>
      ${
        expanded
          ? html`<div class="fields">
              ${
                block.type === 'category'
                  ? this._renderCategoryFields(region, index, block)
                  : blockFields(block, (partial) => this._patchBlock(region, index, partial))
              }
            </div>`
          : nothing
      }
    `;
  }

  /**
   * Renders a category's own fields plus its editable item list.
   */
  private _renderCategoryFields(
    region: Region,
    index: number,
    category: CategoryBlock,
  ): TemplateResult {
    return html`
      ${blockFields(category, (partial) => this._patchBlock(region, index, partial))}
      <div class="subhead">Items</div>
      <div class="rows">
        ${category.items.map((item, j) => this._renderItemRow(region, index, j, item, category.items.length))}
      </div>
      <button class="add-btn" @click=${() => this._addItem(region, index)}>＋ Add item</button>
    `;
  }

  /**
   * Renders one category item row with controls and expandable fields.
   */
  private _renderItemRow(
    region: Region,
    index: number,
    itemIndex: number,
    item: ItemBlock,
    count: number,
  ): TemplateResult {
    const key = `${region}-${index}-i${itemIndex}`;
    const expanded = this._expanded.has(key);
    const patch: Patch = (partial) => this._patchItem(region, index, itemIndex, partial);
    return html`
      <div class="row">
        <span class="rsum">${item.title || '(item)'}</span>
        ${this._renderControls(
          () => this._toggleExpand(key),
          () => this._moveItem(region, index, itemIndex, -1),
          () => this._moveItem(region, index, itemIndex, 1),
          () => this._removeItem(region, index, itemIndex),
          itemIndex === 0,
          itemIndex === count - 1,
        )}
      </div>
      ${
        expanded
          ? html`<div class="fields">${blockFields({ ...item, type: 'item' }, patch)}</div>`
          : nothing
      }
    `;
  }

  /**
   * Renders the footer editor: a mode toggle, then buttons or a card field.
   */
  private _renderFooter(): TemplateResult {
    const footer = this._working.footer;
    const cardMode = footer?.card !== undefined;
    const buttons = footer?.buttons ?? [];
    return html`
      <section class="region">
        <div class="region-head">
          <h3>footer</h3>
          <div class="modes">
            <button
              class="mode ${cardMode ? '' : 'sel'}"
              @click=${() => this._setFooterMode(false)}
            >
              Buttons
            </button>
            <button class="mode ${cardMode ? 'sel' : ''}" @click=${() => this._setFooterMode(true)}>
              Component
            </button>
          </div>
        </div>
        ${
          cardMode
            ? areaField(
                'Card (markdown or JSON)',
                typeof footer?.card === 'string'
                  ? footer.card
                  : JSON.stringify(footer?.card ?? '', null, 2),
                (v) => this._setFooterCard(v),
              )
            : html`
                <div class="rows">
                  ${buttons.map((btn, i) => this._renderFooterButtonRow(i, btn, buttons.length))}
                </div>
                <button class="add-btn" @click=${() => this._addFooterButton()}>
                  ＋ Add button
                </button>
              `
        }
      </section>
    `;
  }

  /**
   * Renders one footer button row with controls and expandable fields.
   */
  private _renderFooterButtonRow(
    index: number,
    btn: { icon?: string; title?: string },
    count: number,
  ): TemplateResult {
    const key = `footer-${index}`;
    const expanded = this._expanded.has(key);
    return html`
      <div class="row">
        <span class="rsum">${btn.icon}${btn.title ? ` · ${btn.title}` : ''}</span>
        ${this._renderControls(
          () => this._toggleExpand(key),
          () => this._moveFooterButton(index, -1),
          () => this._moveFooterButton(index, 1),
          () => this._removeFooterButton(index),
          index === 0,
          index === count - 1,
        )}
      </div>
      ${
        expanded
          ? html`<div class="fields">
              ${footerButtonFields(btn, (partial) => this._patchFooterButton(index, partial))}
            </div>`
          : nothing
      }
    `;
  }

  /**
   * Renders the edit / up / down / delete controls for a row.
   */
  private _renderControls(
    onEdit: () => void,
    onUp: () => void,
    onDown: () => void,
    onDelete: () => void,
    upDisabled: boolean,
    downDisabled: boolean,
  ): TemplateResult {
    return html`
      <button class="icon" title="Edit" @click=${onEdit}>✎</button>
      <button class="icon" title="Move up" ?disabled=${upDisabled} @click=${onUp}>↑</button>
      <button class="icon" title="Move down" ?disabled=${downDisabled} @click=${onDown}>↓</button>
      <button class="icon danger" title="Delete" @click=${onDelete}>✕</button>
    `;
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
        <option value="">＋ Add…</option>
        ${types.map((t) => html`<option value=${t}>${t}</option>`)}
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
      width: min(560px, 92vw);
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      background: var(--card-background-color, #fff);
      border-radius: 12px;
      box-shadow: 0 8px 40px rgb(0 0 0 / 40%);
      overflow: hidden;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-bottom: 1px solid var(--divider-color, rgb(0 0 0 / 12%));
    }

    header h2 {
      margin: 0;
      font-size: 1rem;
    }

    .content {
      padding: 12px;
      overflow-y: auto;
    }

    .region {
      margin-bottom: 16px;
    }

    .region-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .region-head h3 {
      margin: 0;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.7;
    }

    .subhead {
      font-size: 0.75rem;
      text-transform: uppercase;
      opacity: 0.6;
      margin: 8px 0 4px;
    }

    .rows {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 8px;
      background: var(--secondary-background-color, rgb(0 0 0 / 4%));
    }

    .rtype {
      font-size: 0.7rem;
      text-transform: uppercase;
      opacity: 0.6;
      min-width: 52px;
    }

    .rsum {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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

    .fields {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px 8px 12px;
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
      border-top: 1px solid var(--divider-color, rgb(0 0 0 / 12%));
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
