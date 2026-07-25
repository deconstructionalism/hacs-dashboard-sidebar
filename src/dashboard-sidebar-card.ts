// ---------------------------------------------------------------------------
//  DASHBOARD SIDEBAR CARD
//  A collapsible dashboard sidebar for Home Assistant Lovelace.
//  https://github.com/deconstructionalism/hacs-dashboard-sidebar
// ---------------------------------------------------------------------------

import type { HomeAssistant, LovelaceCard, LovelaceCardConfig } from 'custom-card-helpers';
import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

const CARD_VERSION = '0.1.0';

console.info(
  `%c DASHBOARD-SIDEBAR-CARD %c v${CARD_VERSION} `,
  'color: white; background: #3f51b5; font-weight: 700;',
  'color: #3f51b5; background: white; font-weight: 700;',
);

export interface DashboardSidebarConfig extends LovelaceCardConfig {
  title?: string;
}

@customElement('dashboard-sidebar-card')
export class DashboardSidebarCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: DashboardSidebarConfig;

  public setConfig(config: DashboardSidebarConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    this._config = config;
  }

  public getCardSize(): number {
    return 1;
  }

  protected render(): TemplateResult {
    if (!this._config) {
      return html``;
    }

    return html`
      <div class="sidebar">
        <span class="title">${this._config.title ?? 'Dashboard Sidebar'}</span>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      padding: 16px;
      color: var(--sidebar-text-color, var(--primary-text-color, #000));
      background: var(--sidebar-background, var(--card-background-color, #fff));
    }

    .title {
      font-size: 1.25rem;
      font-weight: 500;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'dashboard-sidebar-card': DashboardSidebarCard;
  }

  interface Window {
    customCards?: Array<Record<string, unknown>>;
  }
}

window.customCards = window.customCards ?? [];
window.customCards.push({
  type: 'dashboard-sidebar-card',
  name: 'Dashboard Sidebar Card',
  description: 'A collapsible dashboard sidebar with navigation.',
});
