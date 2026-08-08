import { html, type TemplateResult } from 'lit';

/** Options for a modal confirmation shown over the editor panel. */
export interface ConfirmDialogOptions {
  /** Accessible label for the dialog. */
  label: string;
  /** The question shown to the user. */
  message: string;
  /** Label for the dismiss (non-destructive) button. */
  keepLabel: string;
  /** Label for the confirm (destructive) button. */
  confirmLabel: string;
  /** Run when the dismiss button is clicked. */
  onKeep: () => void;
  /** Run when the destructive button is clicked. */
  onConfirm: () => void;
}

/**
 * A modal confirmation over the panel: a message, a keep (dismiss) button, and a
 * danger (confirm) button.
 */
export const confirmDialog = (opts: ConfirmDialogOptions): TemplateResult => html`
  <div class="confirm-scrim">
    <div class="confirm" role="alertdialog" aria-label=${opts.label}>
      <p>${opts.message}</p>
      <div class="confirm-actions">
        <button @click=${opts.onKeep}>${opts.keepLabel}</button>
        <button class="danger-btn" @click=${opts.onConfirm}>${opts.confirmLabel}</button>
      </div>
    </div>
  </div>
`;
