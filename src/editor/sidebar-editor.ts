import type { HomeAssistant, LovelaceCardConfig } from 'custom-card-helpers';
import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type {
  BlockType,
  DashboardSidebarConfig,
  FooterButtonConfig,
  Region,
  SidebarBlock,
  SidebarConfig,
  SidebarPosition,
} from '../lib/types';
import { validateConfig } from '../lib/validate';
import { defaultBlock, defaultFooterButton, moveBlock, starterSidebar } from './arrange';
import { actionFields, areaField, blockFields, blockSummary, textField } from './block-form';

/** The two sides, in tab order. */
const SIDES: SidebarPosition[] = ['left', 'right'];

/** Every block type, offered when adding to the header. */
const ALL_TYPES: BlockType[] = ['title', 'clock', 'date', 'divider', 'item', 'category', 'card'];

/**
 * The visual editor for the dashboard_sidebar container. Opened by the
 * bootstrap in dashboard edit mode; edits a working copy of the whole
 * {left,right} container and hands it back through `onSave`.
 */
@customElement('dashboard-sidebar-editor')
export class DashboardSidebarEditor extends LitElement {
  /** The current Home Assistant object, for future entity/action pickers. */
  @property({ attribute: false }) public hass?: HomeAssistant;

  /** The container config to edit. Cloned into a working copy on assignment. */
  @property({ attribute: false }) public config?: DashboardSidebarConfig;

  /** Which side's tab to open first. */
  @property({ attribute: false }) public focusSide: SidebarPosition = 'left';

  /** Called with the edited container when the user saves. */
  @property({ attribute: false }) public onSave?: (config: DashboardSidebarConfig) => void;

  /** Called when the editor should close (cancel or after save). */
  @property({ attribute: false }) public onClose?: () => void;

  /** The current tab. */
  @state() private _tab: SidebarPosition = 'left';

  /** Keys (`side-region-index`) of rows expanded for field editing. */
  @state() private _expanded = new Set<string>();

  /** Validation errors from the last save attempt. */
  @state() private _errors: string[] = [];

  /** The mutable working copy of the container. */
  private _working: DashboardSidebarConfig = {};

  /**
   * Clones the incoming config into the working copy and applies the focus tab.
   */
  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('config')) {
      this._working = this.config ? (structuredClone(this.config) as DashboardSidebarConfig) : {};
    }
    if (changed.has('focusSide') && this.focusSide) {
      this._tab = this.focusSide;
    }
  }

  /**
   * Requests a re-render after an in-place mutation of the working copy.
   */
  private _touch(): void {
    this.requestUpdate();
  }

  /**
   * Returns the working config for a side, or undefined when that side is
   * absent.
   */
  private _side(side: SidebarPosition): SidebarConfig | undefined {
    return this._working[side];
  }

  /**
   * Seeds a starter sidebar for a side that does not exist yet.
   */
  private _addSide(side: SidebarPosition): void {
    this._working[side] = starterSidebar();
    this._touch();
  }

  /**
   * Removes a side entirely.
   */
  private _removeSide(side: SidebarPosition): void {
    delete this._working[side];
    this._touch();
  }

  /**
   * Appends a new block of the given type to a region.
   */
  private _addBlock(side: SidebarPosition, region: Region, type: BlockType): void {
    const cfg = this._working[side] ?? (this._working[side] = {});
    const list = cfg[region] ?? (cfg[region] = []);
    list.push(defaultBlock(type));
    this._touch();
  }

  /**
   * Removes the block at a region index.
   */
  private _removeBlock(side: SidebarPosition, region: Region, index: number): void {
    this._working[side]?.[region]?.splice(index, 1);
    this._touch();
  }

  /**
   * Reorders a block within its region by the given step.
   */
  private _move(side: SidebarPosition, region: Region, index: number, delta: number): void {
    const cfg = this._working[side];
    if (!cfg) {
      return;
    }
    this._working[side] = moveBlock(cfg, { region, index }, { region, index: index + delta });
    this._touch();
  }

  /**
   * Merges a partial update into the block at a region index.
   */
  private _patchBlock(
    side: SidebarPosition,
    region: Region,
    index: number,
    partial: Record<string, unknown>,
  ): void {
    const block = this._working[side]?.[region]?.[index];
    if (block) {
      Object.assign(block, partial);
      this._touch();
    }
  }

  /**
   * Switches the footer between button and card mode.
   */
  private _setFooterMode(side: SidebarPosition, mode: string): void {
    const cfg = this._working[side];
    if (!cfg) {
      return;
    }
    cfg.footer = mode === 'card' ? { card: '' } : { buttons: [] };
    this._touch();
  }

  /**
   * Appends a new footer button.
   */
  private _addFooterButton(side: SidebarPosition): void {
    const cfg = this._working[side];
    if (!cfg) {
      return;
    }
    const footer = cfg.footer ?? (cfg.footer = { buttons: [] });
    (footer.buttons ?? (footer.buttons = [])).push(defaultFooterButton());
    this._touch();
  }

  /**
   * Removes the footer button at an index.
   */
  private _removeFooterButton(side: SidebarPosition, index: number): void {
    this._working[side]?.footer?.buttons?.splice(index, 1);
    this._touch();
  }

  /**
   * Reorders a footer button by the given step.
   */
  private _moveFooterButton(side: SidebarPosition, index: number, delta: number): void {
    const buttons = this._working[side]?.footer?.buttons;
    const to = index + delta;
    if (!buttons || to < 0 || to >= buttons.length) {
      return;
    }
    [buttons[index], buttons[to]] = [buttons[to], buttons[index]];
    this._touch();
  }

  /**
   * Merges a partial update into a footer button.
   */
  private _patchFooterButton(
    side: SidebarPosition,
    index: number,
    partial: Record<string, unknown>,
  ): void {
    const btn = this._working[side]?.footer?.buttons?.[index];
    if (btn) {
      Object.assign(btn, partial);
      this._touch();
    }
  }

  /**
   * Sets the footer card content.
   */
  private _setFooterCard(side: SidebarPosition, value: string): void {
    const cfg = this._working[side];
    if (cfg) {
      const trimmed = value.trim();
      let card: string | LovelaceCardConfig = value;
      if (trimmed.startsWith('{')) {
        try {
          card = JSON.parse(trimmed) as LovelaceCardConfig;
        } catch {
          card = value;
        }
      }
      cfg.footer = { card };
      this._touch();
    }
  }

  /**
   * Toggles whether a row is expanded for editing.
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
   * Validates the working copy and, when valid, hands it to `onSave` and closes.
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
   * Closes the editor without saving.
   */
  private _close(): void {
    this.onClose?.();
  }

  /**
   * Renders the modal shell: tabs, the active side, errors, and actions.
   */
  protected render(): TemplateResult {
    return html`
      <div class="backdrop" @click=${this._close}></div>
      <div class="panel" role="dialog" aria-label="Edit sidebar">
        <header>
          <div class="tabs">
            ${SIDES.map(
              (side) => html`
                <button
                  class="tab ${this._tab === side ? 'active' : ''}"
                  @click=${() => {
                    this._tab = side;
                  }}
                >
                  ${side}${this._working[side] ? '' : ' +'}
                </button>
              `,
            )}
          </div>
          <button class="icon" title="Close" @click=${this._close}>✕</button>
        </header>
        <div class="content">${this._renderTab(this._tab)}</div>
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
   * Renders the editor for one side, or its empty state.
   */
  private _renderTab(side: SidebarPosition): TemplateResult {
    if (!this._side(side)) {
      return html`
        <div class="empty">
          <p>No ${side} sidebar yet.</p>
          <button class="primary" @click=${() => this._addSide(side)}>Add ${side} sidebar</button>
        </div>
      `;
    }
    return html`
      ${this._renderSection(side, 'header')} ${this._renderSection(side, 'body')}
      ${this._renderFooterSection(side)}
      <button class="danger" @click=${() => this._removeSide(side)}>Remove ${side} sidebar</button>
    `;
  }

  /**
   * Renders a block region (header or body) with its add control and rows.
   */
  private _renderSection(side: SidebarPosition, region: Region): TemplateResult {
    const blocks = this._side(side)?.[region] ?? [];
    const types = region === 'header' ? ALL_TYPES : ALL_TYPES.filter((t) => t !== 'title');
    return html`
      <section class="region" data-side=${side} data-region=${region}>
        <div class="region-head">
          <h3>${region}</h3>
          <select
            class="add"
            @change=${(e: Event) => {
              const sel = e.target as HTMLSelectElement;
              if (sel.value) {
                this._addBlock(side, region, sel.value as BlockType);
                sel.value = '';
              }
            }}
          >
            <option value="">+ Add…</option>
            ${types.map((t) => html`<option value=${t}>${t}</option>`)}
          </select>
        </div>
        <div class="rows">
          ${blocks.map((block, i) => this._renderRow(side, region, i, block, blocks.length))}
        </div>
      </section>
    `;
  }

  /**
   * Renders a single block row with its controls and expandable fields.
   */
  private _renderRow(
    side: SidebarPosition,
    region: Region,
    index: number,
    block: SidebarBlock,
    count: number,
  ): TemplateResult {
    const key = `${side}-${region}-${index}`;
    const expanded = this._expanded.has(key);
    return html`
      <div class="row" data-region=${region} data-index=${index} data-type=${block.type ?? 'item'}>
        <span class="handle" title="Drag to reorder">⣿</span>
        <span class="rtype">${block.type}</span>
        <span class="rsum">${blockSummary(block)}</span>
        <button class="icon" title="Edit" @click=${() => this._toggleExpand(key)}>✎</button>
        <button
          class="icon"
          title="Move up"
          ?disabled=${index === 0}
          @click=${() => this._move(side, region, index, -1)}
        >
          ↑
        </button>
        <button
          class="icon"
          title="Move down"
          ?disabled=${index === count - 1}
          @click=${() => this._move(side, region, index, 1)}
        >
          ↓
        </button>
        <button
          class="icon danger"
          title="Delete"
          @click=${() => this._removeBlock(side, region, index)}
        >
          ✕
        </button>
      </div>
      ${
        expanded
          ? html`<div class="fields">
              ${blockFields(block, (partial) => this._patchBlock(side, region, index, partial))}
            </div>`
          : nothing
      }
    `;
  }

  /**
   * Renders the footer editor: a mode toggle, then buttons or a card field.
   */
  private _renderFooterSection(side: SidebarPosition): TemplateResult {
    const footer = this._side(side)?.footer;
    const mode = footer?.card !== undefined ? 'card' : 'buttons';
    const buttons = footer?.buttons ?? [];
    return html`
      <section class="region">
        <div class="region-head">
          <h3>footer</h3>
          <select
            @change=${(e: Event) => this._setFooterMode(side, (e.target as HTMLSelectElement).value)}
          >
            <option value="buttons" ?selected=${mode === 'buttons'}>Buttons</option>
            <option value="card" ?selected=${mode === 'card'}>Custom component</option>
          </select>
        </div>
        ${
          mode === 'card'
            ? areaField(
                'Card (markdown or JSON)',
                typeof footer?.card === 'string'
                  ? footer.card
                  : JSON.stringify(footer?.card ?? '', null, 2),
                (v) => this._setFooterCard(side, v),
              )
            : html`
                <div class="rows">
                  ${buttons.map((btn, i) => this._renderFooterButton(side, i, btn, buttons.length))}
                </div>
                <button @click=${() => this._addFooterButton(side)}>+ Add button</button>
              `
        }
      </section>
    `;
  }

  /**
   * Renders a single footer button row with its controls and fields.
   */
  private _renderFooterButton(
    side: SidebarPosition,
    index: number,
    btn: FooterButtonConfig,
    count: number,
  ): TemplateResult {
    const key = `${side}-footer-${index}`;
    const expanded = this._expanded.has(key);
    return html`
      <div class="row" data-index=${index}>
        <span class="handle" title="Drag to reorder">⣿</span>
        <span class="rsum">${btn.icon}${btn.title ? ` · ${btn.title}` : ''}</span>
        <button class="icon" title="Edit" @click=${() => this._toggleExpand(key)}>✎</button>
        <button
          class="icon"
          title="Move up"
          ?disabled=${index === 0}
          @click=${() => this._moveFooterButton(side, index, -1)}
        >
          ↑
        </button>
        <button
          class="icon"
          title="Move down"
          ?disabled=${index === count - 1}
          @click=${() => this._moveFooterButton(side, index, 1)}
        >
          ↓
        </button>
        <button
          class="icon danger"
          title="Delete"
          @click=${() => this._removeFooterButton(side, index)}
        >
          ✕
        </button>
      </div>
      ${
        expanded
          ? html`<div class="fields">
              ${textField('Icon (mdi:...)', btn.icon, (v) => this._patchFooterButton(side, index, { icon: v }))}
              ${textField('Title', btn.title, (v) =>
                this._patchFooterButton(side, index, { title: v || undefined }),
              )}
              ${textField('Entity', btn.entity, (v) =>
                this._patchFooterButton(side, index, { entity: v || undefined }),
              )}
              ${actionFields(btn.tap_action as { action?: string }, (partial) =>
                this._patchFooterButton(side, index, partial),
              )}
            </div>`
          : nothing
      }
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
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--divider-color, rgb(0 0 0 / 12%));
    }

    .tabs {
      display: flex;
      gap: 4px;
      flex: 1;
    }

    .tab {
      text-transform: capitalize;
      padding: 6px 14px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
    }

    .tab.active {
      background: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
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

    .handle {
      cursor: grab;
      opacity: 0.5;
    }

    .rtype {
      font-size: 0.75rem;
      text-transform: uppercase;
      opacity: 0.6;
      min-width: 56px;
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

    .empty {
      text-align: center;
      padding: 24px;
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

    footer button,
    .empty button,
    .danger {
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

    button.danger {
      margin-top: 8px;
      color: var(--error-color, #db4437);
      border-color: var(--error-color, #db4437);
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
