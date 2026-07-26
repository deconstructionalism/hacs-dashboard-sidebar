import { LitElement, css, html, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type { SidebarBlock } from '../lib/types';
import { blockFields, footerButtonFields, type Patch } from './block-form';

/** What kind of value the modal edits, which selects the field set. */
export type BlockModalMode = 'block' | 'footer';

/**
 * A small modal that edits one block (or footer button) via the shared field
 * renderers, on a working copy, and hands it back through `onSave`.
 */
@customElement('dashboard-sidebar-block-modal')
export class DashboardSidebarBlockModal extends LitElement {
  /** The value to edit. Cloned into a working copy on assignment. */
  @property({ attribute: false }) public value?: Record<string, unknown>;

  /** Whether the value is a block or a footer button. */
  @property({ attribute: false }) public mode: BlockModalMode = 'block';

  /** Heading shown at the top of the modal. */
  @property({ attribute: false }) public heading = 'Edit';

  /** Called with the edited value when the user saves. */
  @property({ attribute: false }) public onSave?: (value: Record<string, unknown>) => void;

  /** Called when the modal should close (cancel or after save). */
  @property({ attribute: false }) public onClose?: () => void;

  /** The mutable working copy of the value. */
  @state() private _working: Record<string, unknown> = {};

  /**
   * Clones the incoming value into the working copy.
   */
  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('value')) {
      this._working = this.value ? (structuredClone(this.value) as Record<string, unknown>) : {};
    }
  }

  /**
   * Merges a partial update into the working copy and re-renders.
   */
  private readonly _patch: Patch = (partial) => {
    this._working = { ...this._working, ...partial };
  };

  /**
   * Hands the working copy to `onSave` and closes.
   */
  private _save(): void {
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
   * Renders the modal shell, the field set, and the actions.
   */
  protected render(): TemplateResult {
    const fields =
      this.mode === 'footer'
        ? footerButtonFields(this._working, this._patch)
        : blockFields(this._working as unknown as SidebarBlock, this._patch);
    return html`
      <div class="backdrop" @click=${this._close}></div>
      <div class="panel" role="dialog" aria-label=${this.heading}>
        <header>
          <h2>${this.heading}</h2>
          <button class="icon" title="Close" @click=${this._close}>✕</button>
        </header>
        <div class="content">${fields}</div>
        <footer>
          <button @click=${this._close}>Cancel</button>
          <button class="primary" @click=${this._save}>Save</button>
        </footer>
      </div>
    `;
  }

  /** Styles for the modal. */
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 120;
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
      width: min(440px, 92vw);
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
      display: flex;
      flex-direction: column;
      gap: 8px;
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

    .icon {
      border: none;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
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
  /** Registers the block modal tag for typed DOM lookups. */
  interface HTMLElementTagNameMap {
    /** The per-element settings modal. */
    'dashboard-sidebar-block-modal': DashboardSidebarBlockModal;
  }
}
