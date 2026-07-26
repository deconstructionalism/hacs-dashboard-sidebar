import { html, nothing, type TemplateResult } from 'lit';

import type {
  CardBlock,
  CategoryBlock,
  ClockBlock,
  DateBlock,
  ItemBlock,
  SidebarBlock,
  TitleBlock,
} from '../lib/types';

/** Merges a partial update into the object being edited, then re-renders. */
export type Patch = (partial: Record<string, unknown>) => void;

/** Alignment choices shared by the text and card blocks. */
const ALIGN_OPTIONS = ['left', 'center', 'right'];

/** Tap-action kinds offered by the minimal action editor. */
const ACTION_OPTIONS = ['none', 'toggle', 'more-info', 'navigate', 'call-service'];

/**
 * Renders a labelled single-line text input.
 */
export function textField(
  label: string,
  value: string | undefined,
  onInput: (value: string) => void,
): TemplateResult {
  return html`<label class="field">
    <span>${label}</span>
    <input
      type="text"
      .value=${value ?? ''}
      @input=${(e: Event) => onInput((e.target as HTMLInputElement).value)}
    />
  </label>`;
}

/**
 * Renders a labelled multi-line text area.
 */
export function areaField(
  label: string,
  value: string,
  onInput: (value: string) => void,
): TemplateResult {
  return html`<label class="field">
    <span>${label}</span>
    <textarea
      rows="4"
      .value=${value}
      @input=${(e: Event) => onInput((e.target as HTMLTextAreaElement).value)}
    ></textarea>
  </label>`;
}

/**
 * Renders a labelled dropdown for a fixed set of options.
 */
export function selectField(
  label: string,
  value: string | undefined,
  options: string[],
  onChange: (value: string) => void,
): TemplateResult {
  return html`<label class="field">
    <span>${label}</span>
    <select @change=${(e: Event) => onChange((e.target as HTMLSelectElement).value)}>
      ${options.map((opt) => html`<option value=${opt} ?selected=${opt === value}>${opt}</option>`)}
    </select>
  </label>`;
}

/**
 * Renders a labelled checkbox.
 */
export function checkboxField(
  label: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
): TemplateResult {
  return html`<label class="field field-inline">
    <input
      type="checkbox"
      .checked=${checked}
      @change=${(e: Event) => onChange((e.target as HTMLInputElement).checked)}
    />
    <span>${label}</span>
  </label>`;
}

/**
 * Returns a one-line human summary of a block for its collapsed row.
 */
export function blockSummary(block: SidebarBlock): string {
  switch (block.type) {
    case 'title':
      return (block as TitleBlock).text || '(title)';
    case 'clock':
      return (block as ClockBlock).format ?? 'clock';
    case 'date':
      return (block as DateBlock).format ?? 'date';
    case 'divider':
      return '──';
    case 'item':
      return (block as ItemBlock).title || '(item)';
    case 'category':
      return `${(block as CategoryBlock).title || '(category)'} (${(block as CategoryBlock).items?.length ?? 0})`;
    case 'card':
      return typeof (block as CardBlock).card === 'string' ? 'markdown' : 'card';
    default:
      return '';
  }
}

/**
 * Renders the minimal tap-action editor for an item or footer button.
 */
export function actionFields(
  action: { action?: string; navigation_path?: string; entity?: string },
  patch: Patch,
): TemplateResult {
  const kind = action?.action ?? 'none';
  return html`
    ${selectField('Tap action', kind, ACTION_OPTIONS, (v) =>
      patch({ tap_action: { ...action, action: v } }),
    )}
    ${
      kind === 'navigate'
        ? textField('Navigation path', action?.navigation_path, (v) =>
            patch({ tap_action: { ...action, action: kind, navigation_path: v } }),
          )
        : nothing
    }
  `;
}

/**
 * Renders the editable fields for one footer button, applying edits via patch.
 */
export function footerButtonFields(
  btn: { icon?: string; title?: string; entity?: string; tap_action?: { action?: string } },
  patch: Patch,
): TemplateResult {
  return html`
    ${textField('Icon (mdi:...)', btn.icon, (v) => patch({ icon: v }))}
    ${textField('Title', btn.title, (v) => patch({ title: v || undefined }))}
    ${textField('Entity', btn.entity, (v) => patch({ entity: v || undefined }))}
    ${actionFields(btn.tap_action ?? {}, patch)}
  `;
}

/**
 * Renders the editable fields for one block, applying edits through `patch`.
 */
export function blockFields(block: SidebarBlock, patch: Patch): TemplateResult {
  switch (block.type) {
    case 'title':
      return html`
        ${textField('Text', block.text, (v) => patch({ text: v }))}
        ${selectField('Align', block.align, ALIGN_OPTIONS, (v) => patch({ align: v }))}
      `;
    case 'clock':
      return html`
        ${textField('Format (strftime)', block.format, (v) => patch({ format: v || undefined }))}
        ${selectField('Collapsed', block.collapsed_format ?? '24h', ['24h', '12h'], (v) =>
          patch({ collapsed_format: v }),
        )}
        ${selectField('Align', block.align, ALIGN_OPTIONS, (v) => patch({ align: v }))}
      `;
    case 'date':
      return html`
        ${textField('Format (strftime)', block.format, (v) => patch({ format: v || undefined }))}
        ${selectField('Align', block.align, ALIGN_OPTIONS, (v) => patch({ align: v }))}
      `;
    case 'divider':
      return html`<p class="hint">A horizontal rule. No options.</p>`;
    case 'item':
      return html`
        ${textField('Title', block.title, (v) => patch({ title: v }))}
        ${textField('Icon (mdi:...)', block.icon, (v) => patch({ icon: v || undefined }))}
        ${textField('Entity', block.entity, (v) => patch({ entity: v || undefined }))}
        ${actionFields(block.tap_action as { action?: string }, patch)}
      `;
    case 'category':
      return html`
        ${textField('Title', block.title, (v) => patch({ title: v }))}
        ${textField('Icon (mdi:...)', block.icon, (v) => patch({ icon: v || undefined }))}
        ${checkboxField('Start collapsed', block.start_collapsed ?? true, (v) =>
          patch({ start_collapsed: v }),
        )}
        ${checkboxField('Guide line', block.guide_line ?? true, (v) => patch({ guide_line: v }))}
        <p class="hint">${block.items?.length ?? 0} item(s). Edit items in YAML for now.</p>
      `;
    case 'card':
      return html`
        ${areaField(
          'Card (markdown, or JSON card config)',
          typeof block.card === 'string' ? block.card : JSON.stringify(block.card, null, 2),
          (v) => patch({ card: parseCard(v) }),
        )}
        ${selectField('Align', block.align, ALIGN_OPTIONS, (v) => patch({ align: v }))}
      `;
    default:
      return html``;
  }
}

/**
 * Parses a card field: JSON when it parses to an object, otherwise the raw
 * string (treated as markdown).
 */
function parseCard(value: string): string | Record<string, unknown> {
  const trimmed = value.trim();
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return value;
    }
  }
  return value;
}
