import { type HomeAssistant, handleAction } from 'custom-card-helpers';
import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import { applyCardMod } from './lib/card-mod';
import { STORAGE_PREFIX, TOGGLE_EVENT } from './lib/const';
import {
  formatClock,
  formatCollapsedClock,
  formatCollapsedDate,
  formatDate,
  initials,
} from './lib/format';
import { isCategory, isDivider } from './lib/guards';
import { TemplateManager } from './lib/templates';
import type {
  Align,
  DashboardSidebarConfig,
  SidebarCategoryConfig,
  SidebarEntry,
  SidebarFooterButtonConfig,
  SidebarItemConfig,
} from './lib/types';
import { validateConfig } from './lib/validate';
import { sidebarStyles } from './styles';

/** Maps a config alignment to its flexbox `align-items` value. */
const FLEX_ALIGN: Record<Align, string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};

/**
 * The dashboard sidebar element. Renders the configured header, custom content,
 * menu (items, categories, dividers), and footer buttons, in both the expanded
 * and collapsed layouts, and surfaces config errors in-panel.
 */
@customElement('dashboard-sidebar')
export class DashboardSidebar extends LitElement {
  /** The current Home Assistant object, assigned by the bootstrap. */
  @property({ attribute: false }) public hass?: HomeAssistant;

  /** The validated configuration, or undefined before setConfig runs. */
  @state() private _config?: DashboardSidebarConfig;

  /** Whether the sidebar is currently collapsed to its icon strip. */
  @state() private _collapsed = false;

  /** Clock tick; reassigned each interval so the header re-renders. */
  @state() private _now = new Date();

  /** Index of the collapsed category whose popover is open, or null. */
  @state() private _openCategory: number | null = null;

  /** Viewport rect of the control anchoring an open popover, or null. */
  @state() private _popoverAnchor: DOMRect | null = null;

  /** Whether the footer overflow popover is open. */
  @state() private _footerOpen = false;

  /** Indices of categories currently collapsed in the expanded menu. */
  @state() private _collapsedCats = new Set<number>();

  /** Config validation problems; non-empty switches render to the error panel. */
  @state() private _errors: string[] = [];

  /** Manager that subscribes to and caches templated field values. */
  private readonly _templates = new TemplateManager(() => this.requestUpdate());

  /** Handle of the clock/date interval timer, when running. */
  private _tick?: number;

  /** The instantiated custom-content card, when `content` is configured. */
  private _contentCard?: HTMLElement & { hass?: HomeAssistant };

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
   * collapse set, collects templates, and starts the clock. Invalid configs are
   * kept only as an error list for the panel.
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
    const cats = new Set<number>();
    config.items.forEach((entry, i) => {
      if (isCategory(entry) && (entry.start_collapsed ?? true)) {
        cats.add(i);
      }
    });
    this._collapsedCats = cats;
    this._templates.collect(config);
    this._restartTick();
    void this._buildContent();
  }

  /**
   * Builds the custom-content card element from a markdown string or an
   * embedded card config, using Home Assistant's card helpers.
   */
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
   * so the wrapper resizes, forwards hass to templates and the content card,
   * then (re)applies card-mod.
   */
  protected updated(changed: PropertyValues): void {
    if (changed.has('_collapsed')) {
      this.dispatchEvent(
        new CustomEvent(TOGGLE_EVENT, {
          detail: { collapsed: this._collapsed },
          bubbles: true,
          composed: true,
        }),
      );
    }
    if (changed.has('hass')) {
      this._templates.setHass(this.hass);
      if (this._contentCard) {
        this._contentCard.hass = this.hass;
      }
    }
    this._applyCardMod();
  }

  /**
   * Applies the configured card-mod styles once per config, when the card-mod
   * integration is installed. Retries on later updates until it succeeds, so a
   * card-mod that loads after us is still honored.
   */
  private _applyCardMod(): void {
    const cfg = this._config?.card_mod;
    if (!cfg || this._cardModApplied || this._errors.length > 0) {
      return;
    }
    this._cardModApplied = applyCardMod(this, cfg);
  }

  /**
   * The resolved dock side, defaulting to left.
   */
  private get _position(): 'left' | 'right' {
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
    return `${STORAGE_PREFIX}:${window.location.pathname}:${this._position}`;
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
   * Restarts the clock/date timer, ticking every second when a clock is shown
   * or every minute for date-only, and not at all when neither is configured.
   */
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
  private _runAction(cfg: { entity?: string; tap_action: SidebarItemConfig['tap_action'] }): void {
    if (!this.hass) {
      return;
    }
    handleAction(this, this.hass, { entity: cfg.entity, tap_action: cfg.tap_action }, 'tap');
    this._closePopovers();
  }

  /**
   * Toggles the footer overflow popover open or closed, anchoring it to the
   * clicked control.
   */
  private _toggleFooter(ev: Event): void {
    if (this._footerOpen) {
      this._closePopovers();
      return;
    }
    this._openCategory = null;
    this._footerOpen = true;
    this._popoverAnchor = (ev.currentTarget as HTMLElement).getBoundingClientRect();
  }

  /**
   * Computes fixed-position coordinates for a popover beside its anchor, on the
   * side away from the dock edge and growing up or down as requested.
   */
  private _popoverStyle(anchor: DOMRect, growUp: boolean): Record<string, string> {
    const style: Record<string, string> = {};
    if (this._position === 'left') {
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
   * Toggles the popover for a collapsed category, anchoring it to the row.
   */
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

  /**
   * Toggles whether a category is collapsed within the expanded menu.
   */
  private _toggleCategoryCollapse(index: number): void {
    const next = new Set(this._collapsedCats);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
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
    const collapsed = this._collapsed;
    const cfg = this._config;
    const classes = {
      sidebar: true,
      'dashboard-sidebar-root': true,
      collapsed,
      [`pos-${this._position}`]: true,
    };
    const sidebarStyle = cfg.background ? { background: cfg.background } : {};
    const contentAlign = cfg.content_align ?? 'left';
    const contentIsString = typeof cfg.content === 'string';
    const contentStyle = {
      'align-items': FLEX_ALIGN[contentAlign],
      'text-align': contentAlign,
      // A markdown string is shown chrome-less so it does not draw its own
      // card box inside our content area.
      ...(contentIsString
        ? {
            '--ha-card-background': 'transparent',
            '--ha-card-box-shadow': 'none',
            '--ha-card-border-width': '0px',
          }
        : {}),
      ...(cfg.content_background
        ? { background: cfg.content_background, padding: '8px', 'border-radius': '8px' }
        : {}),
    };

    return html`
      <div class=${classMap(classes)} style=${styleMap(sidebarStyle)}>
        <button
          class="toggle dashboard-sidebar-toggle"
          title=${collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          @click=${this._toggleCollapse}
        >
          <ha-icon icon="mdi:chevron-left"></ha-icon>
        </button>
        ${this._renderHeader(collapsed)}
        ${
          this._contentCard
            ? html`<div class="content dashboard-sidebar-content" style=${styleMap(contentStyle)}>
                ${this._contentCard}
              </div>`
            : nothing
        }
        <nav class="menu dashboard-sidebar-menu">
          ${cfg.items.map((entry, i) => this._renderEntry(entry, i, collapsed))}
        </nav>
        ${this._renderFooter(collapsed)}
      </div>
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

  /**
   * Renders the header block (title, clock, date), or nothing when none are
   * enabled. The title is hidden while collapsed.
   */
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
    const headerStyle = { 'text-align': cfg.header_align ?? 'center' };
    return html`
      <div class="header dashboard-sidebar-header" style=${styleMap(headerStyle)}>
        ${title ? html`<div class="app-title dashboard-sidebar-title">${title}</div>` : nothing}
        ${
          showClock
            ? html`<div class="clock dashboard-sidebar-clock">
                ${
                  collapsed
                    ? formatCollapsedClock(this._now, cfg.collapsed_clock_format === '12h')
                    : formatClock(this._now, cfg.clock_format ?? 'locale', this._locale)
                }
              </div>`
            : nothing
        }
        ${
          showDate
            ? html`<div class="date dashboard-sidebar-date">
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

  /**
   * Renders one menu entry, dispatching on divider, category (collapsed or
   * expanded), or item.
   */
  private _renderEntry(entry: SidebarEntry, index: number, collapsed: boolean): TemplateResult {
    if (isDivider(entry)) {
      return html`<div class="entry-divider dashboard-sidebar-divider"></div>`;
    }
    if (isCategory(entry)) {
      return collapsed
        ? this._renderCollapsedCategory(entry, index)
        : this._renderExpandedCategory(entry, index);
    }
    return this._renderItemRow(entry, collapsed);
  }

  /**
   * Renders a single item row: an icon-only button when collapsed (falling back
   * to initials), or an icon-and-label row when expanded.
   */
  private _renderItemRow(item: SidebarItemConfig, collapsed: boolean): TemplateResult {
    const title = this._templates.resolve(item.title);
    const icon = item.icon ? this._templates.resolve(item.icon) : '';
    const textColor = item.text_color ? this._templates.resolve(item.text_color) : '';
    const iconColor = item.icon_color ? this._templates.resolve(item.icon_color) : '';

    if (collapsed) {
      return html`
        <button
          class="row item collapsed-row dashboard-sidebar-item"
          title=${title}
          @click=${() => this._runAction(item)}
        >
          ${
            icon
              ? html`<ha-icon
                  class="dashboard-sidebar-item-icon"
                  icon=${icon}
                  style=${styleMap({ color: iconColor })}
                ></ha-icon>`
              : html`<span class="initials dashboard-sidebar-initials">${initials(title)}</span>`
          }
        </button>
      `;
    }

    return html`
      <button class="row item dashboard-sidebar-item" @click=${() => this._runAction(item)}>
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
  private _renderExpandedCategory(category: SidebarCategoryConfig, index: number): TemplateResult {
    const title = this._templates.resolve(category.title);
    const icon = category.icon ? this._templates.resolve(category.icon) : '';
    const collapsed = this._collapsedCats.has(index);
    return html`
      <div class="category dashboard-sidebar-category">
        <button
          class="row category-header dashboard-sidebar-category-header"
          @click=${() => this._toggleCategoryCollapse(index)}
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
   * Renders a collapsed category as an icon button that opens a popover listing
   * its items.
   */
  private _renderCollapsedCategory(category: SidebarCategoryConfig, index: number): TemplateResult {
    const title = this._templates.resolve(category.title);
    const icon = category.icon ? this._templates.resolve(category.icon) : '';
    const open = this._openCategory === index;
    return html`
      <div class="category-anchor dashboard-sidebar-category">
        <button
          class="row item collapsed-row dashboard-sidebar-item ${open ? 'active' : ''}"
          title=${title}
          @click=${(ev: Event) => {
            ev.stopPropagation();
            this._toggleCategory(index, ev);
          }}
        >
          ${
            icon
              ? html`<ha-icon class="dashboard-sidebar-item-icon" icon=${icon}></ha-icon>`
              : html`<span class="initials dashboard-sidebar-initials">${initials(title)}</span>`
          }
        </button>
        ${open && this._popoverAnchor ? this._renderPopover(category, this._popoverAnchor) : nothing}
      </div>
    `;
  }

  /**
   * Renders a collapsed category's popover: its title and item rows, fixed to
   * the viewport so it escapes the scrollable menu's clipping.
   */
  private _renderPopover(category: SidebarCategoryConfig, anchor: DOMRect): TemplateResult {
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
   * Renders the footer button bar. Collapsed shows a dots menu; expanded fits
   * as many buttons as the width allows and moves the rest behind a dots menu.
   */
  private _renderFooter(collapsed: boolean): TemplateResult | typeof nothing {
    const buttons = this._config?.footer_buttons ?? [];
    if (buttons.length === 0) {
      return nothing;
    }
    const anchor = this._popoverAnchor;
    const footerClasses = {
      footer: true,
      'dashboard-sidebar-footer': true,
      'collapsed-footer': collapsed,
      'no-divider': this._config?.footer_divider === false,
    };

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
   * Renders the overflow "dots" button that opens the footer popover.
   */
  private _renderDots(cls: string): TemplateResult {
    return html`
      <button
        class="${cls} ${this._footerOpen ? 'active' : ''}"
        title="More"
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
    buttons: SidebarFooterButtonConfig[],
    anchor: DOMRect,
  ): TemplateResult {
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
  private _renderFooterButton(btn: SidebarFooterButtonConfig): TemplateResult {
    const icon = this._templates.resolve(btn.icon);
    const color = btn.icon_color ? this._templates.resolve(btn.icon_color) : '';
    const title = btn.title ? this._templates.resolve(btn.title) : '';
    return html`
      <button
        class="footer-btn dashboard-sidebar-footer-btn"
        title=${title}
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
