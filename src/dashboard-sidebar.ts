import { type HomeAssistant, handleAction } from 'custom-card-helpers';
import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import { STORAGE_PREFIX } from './const';
import {
  formatClock,
  formatCollapsedClock,
  formatCollapsedDate,
  formatDate,
  initials,
} from './format';
import { TemplateManager } from './templates';
import {
  type DashboardSidebarConfig,
  type SidebarCategoryConfig,
  type SidebarEntry,
  type SidebarFooterButtonConfig,
  type SidebarItemConfig,
  isCategory,
  validateConfig,
} from './types';

/** Fired when the collapsed state changes so the bootstrap can resize. */
export const TOGGLE_EVENT = 'dashboard-sidebar-toggle';

@customElement('dashboard-sidebar')
export class DashboardSidebar extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: DashboardSidebarConfig;

  @state() private _collapsed = false;

  @state() private _now = new Date();

  @state() private _openCategory: number | null = null;

  @state() private _popoverAnchor: DOMRect | null = null;

  @state() private _footerOpen = false;

  @state() private _collapsedCats = new Set<number>();

  private readonly _templates = new TemplateManager(() => this.requestUpdate());

  private _tick?: number;

  private _contentCard?: HTMLElement & { hass?: HomeAssistant };

  private readonly _onDocumentClick = (ev: MouseEvent): void => {
    if ((this._openCategory !== null || this._footerOpen) && !ev.composedPath().includes(this)) {
      this._closePopovers();
    }
  };

  private _closePopovers(): void {
    this._openCategory = null;
    this._footerOpen = false;
    this._popoverAnchor = null;
  }

  public setConfig(config: DashboardSidebarConfig): void {
    validateConfig(config);
    this._config = config;
    this._collapsed = this._readStored() ?? Boolean(config.start_collapsed);
    this._templates.collect(config);
    this._restartTick();
    void this._buildContent();
  }

  private async _buildContent(): Promise<void> {
    this._contentCard = undefined;
    const content = this._config?.content;
    if (!content) {
      return;
    }
    const helpers = await (
      window as unknown as { loadCardHelpers?: () => Promise<any> }
    ).loadCardHelpers?.();
    if (!helpers) {
      return;
    }
    const cardConfig = typeof content === 'string' ? { type: 'markdown', content } : content;
    const card = helpers.createCardElement(cardConfig) as HTMLElement & { hass?: HomeAssistant };
    card.hass = this.hass;
    this._contentCard = card;
    this.requestUpdate();
  }

  public connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('click', this._onDocumentClick);
    this._restartTick();
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('click', this._onDocumentClick);
    this._stopTick();
    this._templates.clear();
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('hass')) {
      this._templates.setHass(this.hass);
      if (this._contentCard) {
        this._contentCard.hass = this.hass;
      }
    }
    if (changed.has('_collapsed')) {
      this.dispatchEvent(
        new CustomEvent(TOGGLE_EVENT, {
          detail: { collapsed: this._collapsed },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private get _position(): 'left' | 'right' {
    return this._config?.position === 'right' ? 'right' : 'left';
  }

  private get _locale(): string {
    return this.hass?.locale?.language ?? navigator.language;
  }

  private _storageKey(): string {
    return `${STORAGE_PREFIX}:${window.location.pathname}:${this._position}`;
  }

  private _readStored(): boolean | null {
    try {
      const raw = window.localStorage.getItem(this._storageKey());
      return raw === null ? null : raw === '1';
    } catch {
      return null;
    }
  }

  private _restartTick(): void {
    this._stopTick();
    if (!this._config?.clock && !this._config?.date) {
      return;
    }
    const interval = this._config.clock ? 1000 : 60000;
    this._tick = window.setInterval(() => {
      this._now = new Date();
    }, interval);
  }

  private _stopTick(): void {
    if (this._tick !== undefined) {
      window.clearInterval(this._tick);
      this._tick = undefined;
    }
  }

  private _toggleCollapse(): void {
    this._collapsed = !this._collapsed;
    this._closePopovers();
    try {
      window.localStorage.setItem(this._storageKey(), this._collapsed ? '1' : '0');
    } catch {
      // localStorage unavailable; the toggle still works for the session
    }
  }

  private _runAction(cfg: { entity?: string; tap_action: SidebarItemConfig['tap_action'] }): void {
    if (!this.hass) {
      return;
    }
    handleAction(this, this.hass, { entity: cfg.entity, tap_action: cfg.tap_action }, 'tap');
    this._closePopovers();
  }

  private _toggleFooter(ev: Event): void {
    if (this._footerOpen) {
      this._closePopovers();
      return;
    }
    this._openCategory = null;
    this._footerOpen = true;
    this._popoverAnchor = (ev.currentTarget as HTMLElement).getBoundingClientRect();
  }

  private _popoverStyle(anchor: DOMRect, growUp: boolean): Record<string, string> {
    const side =
      this._position === 'left'
        ? { left: `${anchor.right + 8}px` }
        : { right: `${window.innerWidth - anchor.left + 8}px` };
    const vert = growUp
      ? { bottom: `${window.innerHeight - anchor.bottom}px` }
      : { top: `${anchor.top}px` };
    return { ...side, ...vert };
  }

  private _toggleCategory(index: number, ev: Event): void {
    if (this._openCategory === index) {
      this._openCategory = null;
      this._popoverAnchor = null;
      return;
    }
    this._footerOpen = false;
    this._openCategory = index;
    this._popoverAnchor = (ev.currentTarget as HTMLElement).getBoundingClientRect();
  }

  private _toggleCategoryCollapse(index: number): void {
    const next = new Set(this._collapsedCats);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    this._collapsedCats = next;
  }

  protected render(): TemplateResult {
    if (!this._config) {
      return html``;
    }
    const collapsed = this._collapsed;
    const classes = { sidebar: true, collapsed, [`pos-${this._position}`]: true };

    return html`
      <div class=${classMap(classes)}>
        <button
          class="toggle"
          title=${collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          @click=${this._toggleCollapse}
        >
          <ha-icon icon="mdi:chevron-left"></ha-icon>
        </button>
        ${this._renderHeader(collapsed)}
        ${this._contentCard ? html`<div class="content">${this._contentCard}</div>` : nothing}
        <nav class="menu">
          ${this._config.items.map((entry, i) => this._renderEntry(entry, i, collapsed))}
        </nav>
        ${this._renderFooter(collapsed)}
      </div>
    `;
  }

  private _renderHeader(collapsed: boolean): TemplateResult | typeof nothing {
    const cfg = this._config;
    if (!cfg) {
      return nothing;
    }
    const title = !collapsed && cfg.title ? this._templates.resolve(cfg.title) : '';
    const showClock = cfg.clock;
    const showDate = cfg.date;
    if (!title && !showClock && !showDate) {
      return nothing;
    }
    return html`
      <div class="header">
        ${title ? html`<div class="app-title">${title}</div>` : nothing}
        ${
          showClock
            ? html`<div class="clock">
                ${
                  collapsed
                    ? formatCollapsedClock(this._now)
                    : formatClock(this._now, cfg.clock_format ?? 'locale', this._locale)
                }
              </div>`
            : nothing
        }
        ${
          showDate
            ? html`<div class="date">
                ${
                  collapsed
                    ? formatCollapsedDate(this._now)
                    : formatDate(this._now, cfg.date_format ?? 'locale', this._locale)
                }
              </div>`
            : nothing
        }
      </div>
    `;
  }

  private _renderEntry(entry: SidebarEntry, index: number, collapsed: boolean): TemplateResult {
    if (isCategory(entry)) {
      return collapsed
        ? this._renderCollapsedCategory(entry, index)
        : this._renderExpandedCategory(entry, index);
    }
    return this._renderItemRow(entry, collapsed);
  }

  private _renderItemRow(item: SidebarItemConfig, collapsed: boolean): TemplateResult {
    const title = this._templates.resolve(item.title);
    const icon = item.icon ? this._templates.resolve(item.icon) : '';
    const textColor = item.text_color ? this._templates.resolve(item.text_color) : '';
    const iconColor = item.icon_color ? this._templates.resolve(item.icon_color) : '';

    if (collapsed) {
      return html`
        <button class="row item collapsed-row" title=${title} @click=${() => this._runAction(item)}>
          ${
            icon
              ? html`<ha-icon icon=${icon} style=${styleMap({ color: iconColor })}></ha-icon>`
              : html`<span class="initials">${initials(title)}</span>`
          }
        </button>
      `;
    }

    return html`
      <button class="row item" @click=${() => this._runAction(item)}>
        ${
          icon
            ? html`<ha-icon icon=${icon} style=${styleMap({ color: iconColor })}></ha-icon>`
            : nothing
        }
        <span class="label" style=${styleMap({ color: textColor })}>${title}</span>
      </button>
    `;
  }

  private _renderExpandedCategory(category: SidebarCategoryConfig, index: number): TemplateResult {
    const title = this._templates.resolve(category.title);
    const icon = category.icon ? this._templates.resolve(category.icon) : '';
    const collapsed = this._collapsedCats.has(index);
    return html`
      <div class="category">
        <button class="row category-header" @click=${() => this._toggleCategoryCollapse(index)}>
          ${icon ? html`<ha-icon icon=${icon}></ha-icon>` : nothing}
          <span class="label">${title}</span>
          <ha-icon class="chevron ${collapsed ? '' : 'open'}" icon="mdi:chevron-down"></ha-icon>
        </button>
        ${
          collapsed
            ? nothing
            : html`<div class="category-items">
                ${category.items.map((item) => this._renderItemRow(item, false))}
              </div>`
        }
      </div>
    `;
  }

  private _renderCollapsedCategory(category: SidebarCategoryConfig, index: number): TemplateResult {
    const title = this._templates.resolve(category.title);
    const icon = category.icon ? this._templates.resolve(category.icon) : '';
    const open = this._openCategory === index;
    return html`
      <div class="category-anchor">
        <button
          class="row item collapsed-row ${open ? 'active' : ''}"
          title=${title}
          @click=${(ev: Event) => {
            ev.stopPropagation();
            this._toggleCategory(index, ev);
          }}
        >
          ${
            icon
              ? html`<ha-icon icon=${icon}></ha-icon>`
              : html`<span class="initials">${initials(title)}</span>`
          }
        </button>
        ${open && this._popoverAnchor ? this._renderPopover(category, this._popoverAnchor) : nothing}
      </div>
    `;
  }

  private _renderPopover(category: SidebarCategoryConfig, anchor: DOMRect): TemplateResult {
    // Fixed to the viewport so it escapes the scrollable menu's clipping.
    return html`
      <div
        class="popover"
        style=${styleMap(this._popoverStyle(anchor, false))}
        @click=${(ev: Event) => ev.stopPropagation()}
      >
        <div class="popover-title">${this._templates.resolve(category.title)}</div>
        ${category.items.map((item) => this._renderItemRow(item, false))}
      </div>
    `;
  }

  private _renderFooter(collapsed: boolean): TemplateResult | typeof nothing {
    const buttons = this._config?.footer_buttons ?? [];
    if (buttons.length === 0) {
      return nothing;
    }
    if (collapsed) {
      return html`
        <div class="footer collapsed-footer">
          <button
            class="row item collapsed-row ${this._footerOpen ? 'active' : ''}"
            title="More"
            @click=${(ev: Event) => {
              ev.stopPropagation();
              this._toggleFooter(ev);
            }}
          >
            <ha-icon icon="mdi:dots-vertical"></ha-icon>
          </button>
          ${
            this._footerOpen && this._popoverAnchor
              ? html`<div
                  class="popover footer-popover"
                  style=${styleMap(this._popoverStyle(this._popoverAnchor, true))}
                  @click=${(ev: Event) => ev.stopPropagation()}
                >
                  ${buttons.map((btn) => this._renderFooterButton(btn))}
                </div>`
              : nothing
          }
        </div>
      `;
    }
    return html` <div class="footer">${buttons.map((btn) => this._renderFooterButton(btn))}</div> `;
  }

  private _renderFooterButton(btn: SidebarFooterButtonConfig): TemplateResult {
    const icon = this._templates.resolve(btn.icon);
    const color = btn.icon_color ? this._templates.resolve(btn.icon_color) : '';
    const title = btn.title ? this._templates.resolve(btn.title) : '';
    return html`
      <button class="footer-btn" title=${title} @click=${() => this._runAction(btn)}>
        <ha-icon icon=${icon} style=${styleMap({ color })}></ha-icon>
      </button>
    `;
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
      box-sizing: border-box;
      color: var(--primary-text-color, #000);
      background: var(--card-background-color, var(--primary-background-color, #fff));
      font-family: var(--ha-font-family-body, inherit);
    }

    .sidebar {
      position: relative;
      display: flex;
      height: 100%;
      flex-direction: column;
      box-sizing: border-box;
      padding: 16px 12px;
      overflow: visible;
    }

    .sidebar.collapsed {
      align-items: center;
      padding: 16px 6px;
    }

    .toggle {
      position: absolute;
      top: 16px;
      width: 26px;
      height: 26px;
      padding: 0;
      border: 1px solid var(--divider-color, rgb(0 0 0 / 12%));
      border-radius: 50%;
      background: var(--card-background-color, var(--primary-background-color, #fff));
      color: var(--primary-text-color, #000);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 6;
      box-shadow: 0 1px 4px rgb(0 0 0 / 25%);
    }

    .pos-left .toggle {
      right: -13px;
    }

    .pos-right .toggle {
      left: -13px;
    }

    .toggle ha-icon {
      --mdc-icon-size: 18px;
      transition: transform 0.2s ease;
    }

    .pos-right .toggle ha-icon {
      transform: rotate(180deg);
    }

    .collapsed.pos-left .toggle ha-icon {
      transform: rotate(180deg);
    }

    .collapsed.pos-right .toggle ha-icon {
      transform: rotate(0deg);
    }

    .header {
      margin-bottom: 16px;
      text-align: center;
    }

    .app-title {
      font-size: 1.25rem;
      font-weight: 500;
      margin-bottom: 8px;
    }

    .clock {
      font-size: 1.5rem;
      font-weight: 300;
      font-variant-numeric: tabular-nums;
    }

    .collapsed .clock {
      font-size: 0.85rem;
    }

    .date {
      font-size: 0.9rem;
      opacity: 0.75;
      font-variant-numeric: tabular-nums;
    }

    .collapsed .date {
      font-size: 0.7rem;
    }

    .menu {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      gap: 2px;
      width: 100%;
      min-height: 0;
      overflow-y: auto;
    }

    .collapsed .menu {
      align-items: center;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 12px;
      border: none;
      border-radius: 10px;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    .row:hover {
      background: var(--divider-color, rgb(0 0 0 / 8%));
    }

    .row .label {
      flex: 1;
      font-size: 1rem;
    }

    .collapsed-row {
      width: 44px;
      height: 44px;
      justify-content: center;
      padding: 0;
      gap: 0;
    }

    .collapsed-row.active {
      background: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
    }

    .initials {
      font-size: 0.85rem;
      font-weight: 600;
    }

    .category {
      margin: 4px 0;
    }

    .category-header {
      font-weight: 600;
      opacity: 0.85;
    }

    .chevron {
      --mdc-icon-size: 20px;
      flex: 0 0 auto;
      opacity: 0.7;
      transition: transform 0.2s ease;
    }

    .chevron:not(.open) {
      transform: rotate(-90deg);
    }

    .category-items {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-left: 8px;
      border-left: 1px solid var(--divider-color, rgb(0 0 0 / 12%));
      margin-left: 18px;
    }

    .category-anchor {
      position: relative;
    }

    .popover {
      position: fixed;
      min-width: 180px;
      padding: 8px;
      border-radius: 12px;
      background: var(--card-background-color, var(--primary-background-color, #fff));
      box-shadow: 0 4px 16px rgb(0 0 0 / 30%);
      z-index: 9;
    }

    .content {
      margin-bottom: 12px;
    }

    .collapsed .content {
      display: none;
    }

    .popover-title {
      font-weight: 600;
      padding: 4px 12px 8px;
    }

    .footer {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--divider-color, rgb(0 0 0 / 12%));
    }

    .collapsed .footer {
      justify-content: center;
    }

    .footer-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      padding: 0;
      border: none;
      border-radius: 10px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    .footer-btn:hover {
      background: var(--divider-color, rgb(0 0 0 / 8%));
    }

    .footer-popover {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      max-width: 200px;
    }

    ha-icon {
      color: var(--paper-item-icon-color, var(--primary-text-color, #000));
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'dashboard-sidebar': DashboardSidebar;
  }
}
