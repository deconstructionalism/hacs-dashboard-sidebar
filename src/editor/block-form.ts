import { html, nothing, type TemplateResult } from 'lit';

import { DATE_TOKENS, TIME_TOKENS, invalidToken } from '../lib/format';
import type { SidebarBlock } from '../lib/types';

/** Merges a partial update into the object being edited, then re-renders. */
export type Patch = (partial: Record<string, unknown>) => void;

/** Optional validation wiring for a single input. */
export interface FieldOpts {
  /** The validation error to show beneath the input, if any. */
  error?: string;
  /** Called with the input's value when it loses focus, to validate it. */
  onBlur?: (value: string) => void;
}

/** Per-field validation context threaded through the block form. */
export interface ValidationCtx {
  /** Returns the current error message for a field key, if any. */
  errorFor: (key: string) => string | undefined;
  /** Validates a field's value on blur and records the result under its key. */
  onBlur: (key: string, value: string, validate: (value: string) => string | null) => void;
}

/** Named clock formats that are valid without being strftime patterns. */
const CLOCK_ALIASES = new Set(['locale', 'iso', '24h', '12h']);

/** Named date formats that are valid without being strftime patterns. */
const DATE_ALIASES = new Set(['locale', 'iso']);

/**
 * Validates a clock format: empty, a known alias, or an strftime pattern using
 * only time tokens.
 */
export function validateClockFormat(value: string): string | null {
  const v = value.trim();
  if (!v || CLOCK_ALIASES.has(v)) {
    return null;
  }
  const bad = invalidToken(v, TIME_TOKENS);
  return bad ? `Unsupported time token ${bad}` : null;
}

/**
 * Validates a date format: empty, a known alias, or an strftime pattern using
 * only date tokens.
 */
export function validateDateFormat(value: string): string | null {
  const v = value.trim();
  if (!v || DATE_ALIASES.has(v)) {
    return null;
  }
  const bad = invalidToken(v, DATE_TOKENS);
  return bad ? `Unsupported date token ${bad}` : null;
}

/**
 * Validates a `domain.service` string, allowing empty.
 */
export function validateService(value: string): string | null {
  const v = value.trim();
  if (!v) {
    return null;
  }
  return /^[a-z_]+\.[a-z0-9_]+$/i.test(v) ? null : 'Use the form domain.service';
}

/**
 * Validates that a non-empty value parses as JSON, allowing empty.
 */
export function validateJsonField(value: string): string | null {
  const v = value.trim();
  if (!v) {
    return null;
  }
  try {
    JSON.parse(v);
    return null;
  } catch {
    return 'Invalid JSON';
  }
}

/**
 * Validates a card field: markdown is always fine; a value that opens with `{`
 * is treated as JSON and must parse.
 */
export function validateCardField(value: string): string | null {
  return value.trim().startsWith('{') ? validateJsonField(value) : null;
}

/**
 * Validates a width: empty (use default) or a positive integer.
 */
export function validateWidth(value: string): string | null {
  const v = value.trim();
  if (!v) {
    return null;
  }
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? null : 'Must be a positive number';
}

/**
 * Builds the validation opts for a field from a context, or undefined when no
 * context is supplied.
 */
export function fieldOpts(
  ctx: ValidationCtx | undefined,
  key: string,
  validate: (value: string) => string | null,
): FieldOpts | undefined {
  if (!ctx) {
    return undefined;
  }
  return { error: ctx.errorFor(key), onBlur: (value) => ctx.onBlur(key, value, validate) };
}

/** Alignment choices shared by the text and card blocks. */
const ALIGN_OPTIONS = ['left', 'center', 'right'];

/** Tap-action kinds offered by the action editor. */
const ACTION_OPTIONS = ['none', 'toggle', 'more-info', 'navigate', 'url', 'call-service'];

/**
 * Renders a labelled single-line text input.
 */
export function textField(
  label: string,
  value: string | undefined,
  onInput: (value: string) => void,
  opts?: FieldOpts,
): TemplateResult {
  return html`<label class="field ${opts?.error ? 'invalid' : ''}">
    <span>${label}</span>
    <input
      type="text"
      .value=${value ?? ''}
      @input=${(e: Event) => onInput((e.target as HTMLInputElement).value)}
      @blur=${(e: Event) => opts?.onBlur?.((e.target as HTMLInputElement).value)}
    />
    ${opts?.error ? html`<span class="field-error">${opts.error}</span>` : nothing}
  </label>`;
}

/**
 * Renders a labelled multi-line text area.
 */
export function areaField(
  label: string,
  value: string,
  onInput: (value: string) => void,
  opts?: FieldOpts,
): TemplateResult {
  return html`<label class="field ${opts?.error ? 'invalid' : ''}">
    <span>${label}</span>
    <textarea
      rows="4"
      .value=${value}
      @input=${(e: Event) => onInput((e.target as HTMLTextAreaElement).value)}
      @blur=${(e: Event) => opts?.onBlur?.((e.target as HTMLTextAreaElement).value)}
    ></textarea>
    ${opts?.error ? html`<span class="field-error">${opts.error}</span>` : nothing}
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
  description?: string,
): TemplateResult {
  return html`<label class="field field-inline">
    <input
      type="checkbox"
      .checked=${checked}
      @change=${(e: Event) => onChange((e.target as HTMLInputElement).checked)}
    />
    <span class="check-label">
      <span>${label}</span>
      ${description ? html`<small class="field-desc">${description}</small>` : nothing}
    </span>
  </label>`;
}

/**
 * Capitalizes the first letter of a word, for display labels.
 */
export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Renders a labelled integer input that accepts only digits, reporting
 * undefined when cleared.
 */
export function intField(
  label: string,
  value: number | undefined,
  onInput: (value: number | undefined) => void,
  opts?: FieldOpts,
): TemplateResult {
  return html`<label class="field ${opts?.error ? 'invalid' : ''}">
    <span>${label}</span>
    <input
      type="text"
      inputmode="numeric"
      .value=${value != null ? String(value) : ''}
      @input=${(e: Event) => {
        const el = e.target as HTMLInputElement;
        const digits = el.value.replace(/[^0-9]/g, '');
        el.value = digits;
        onInput(digits === '' ? undefined : Number(digits));
      }}
      @blur=${(e: Event) => opts?.onBlur?.((e.target as HTMLInputElement).value)}
    />
    ${opts?.error ? html`<span class="field-error">${opts.error}</span>` : nothing}
  </label>`;
}

/**
 * Renders a labelled color field: a native color swatch alongside a free-text
 * input, so any CSS color (hex, rgb, var(), name) can still be typed.
 */
export function colorField(
  label: string,
  value: string | undefined,
  onInput: (value: string) => void,
): TemplateResult {
  const swatch = /^#[0-9a-fA-F]{6}$/.test(value ?? '') ? (value as string) : '#000000';
  return html`<label class="field">
    <span>${label}</span>
    <div class="color-row">
      <input
        class="color-swatch"
        type="color"
        .value=${swatch}
        @input=${(e: Event) => onInput((e.target as HTMLInputElement).value)}
        @change=${(e: Event) => {
          const el = e.target as HTMLInputElement;
          onInput(el.value);
          // Blur once the OS picker commits, so the swatch reopens on the next
          // click (a focused color input otherwise won't reopen its picker).
          el.blur();
        }}
      />
      <input
        type="text"
        .value=${value ?? ''}
        @input=${(e: Event) => onInput((e.target as HTMLInputElement).value)}
      />
    </div>
  </label>`;
}

/**
 * Renders a labelled single-choice group of icon buttons.
 */
export function iconChoiceField(
  label: string,
  value: string,
  options: Array<{ value: string; icon: string; title: string }>,
  onChange: (value: string) => void,
): TemplateResult {
  return html`<div class="field">
    <span>${label}</span>
    <div class="icon-choice">
      ${options.map(
        (opt) =>
          html`<button
            type="button"
            class="choice ${opt.value === value ? 'sel' : ''}"
            title=${opt.title}
            aria-label=${opt.title}
            @click=${() => onChange(opt.value)}
          >
            <ha-icon icon=${opt.icon}></ha-icon>
            <span class="choice-label">${opt.title}</span>
          </button>`,
      )}
    </div>
  </div>`;
}

/**
 * Parses a JSON object from a textarea, or undefined when empty/invalid.
 */
function parseJson(value: string): Record<string, unknown> | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Renders the minimal tap-action editor for an item or footer button.
 */
export function actionFields(
  action: {
    action?: string;
    navigation_path?: string;
    url_path?: string;
    entity?: string;
    service?: string;
    data?: Record<string, unknown>;
  },
  patch: Patch,
  ctx?: ValidationCtx,
): TemplateResult {
  const kind = action?.action ?? 'none';
  const set = (partial: Record<string, unknown>): void =>
    patch({ tap_action: { ...action, action: kind, ...partial } });
  return html`
    ${selectField('Tap action', kind, ACTION_OPTIONS, (v) =>
      patch({ tap_action: { ...action, action: v } }),
    )}
    ${
      kind === 'navigate'
        ? textField('Navigation path', action.navigation_path, (v) => set({ navigation_path: v }))
        : nothing
    }
    ${kind === 'url' ? textField('URL', action.url_path, (v) => set({ url_path: v })) : nothing}
    ${
      kind === 'toggle' || kind === 'more-info'
        ? textField('Entity', action.entity, (v) => set({ entity: v || undefined }))
        : nothing
    }
    ${
      kind === 'call-service'
        ? html`
            ${textField(
              'Service (domain.service)',
              action.service,
              (v) => set({ service: v }),
              fieldOpts(ctx, 'service', validateService),
            )}
            ${textField('Target entity', action.entity, (v) => set({ entity: v || undefined }))}
            ${areaField(
              'Service data (JSON)',
              action.data ? JSON.stringify(action.data, null, 2) : '',
              (v) => set({ data: parseJson(v) }),
              fieldOpts(ctx, 'data', validateJsonField),
            )}
          `
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
  ctx?: ValidationCtx,
): TemplateResult {
  return html`
    ${textField('Icon (mdi:...)', btn.icon, (v) => patch({ icon: v }))}
    ${textField('Title', btn.title, (v) => patch({ title: v || undefined }))}
    ${textField('Entity', btn.entity, (v) => patch({ entity: v || undefined }))}
    ${actionFields(btn.tap_action ?? {}, patch, ctx)}
  `;
}

/**
 * Renders the class/id (and, for items/categories, abbr) hooks under a native
 * collapsible Advanced section.
 */
function advancedFields(
  block: { class?: string; id?: string; abbr?: string; icon?: unknown },
  patch: Patch,
  withAbbr: boolean,
): TemplateResult {
  return html`<details class="advanced">
    <summary>Advanced</summary>
    ${textField('CSS class', block.class, (v) => patch({ class: v || undefined }))}
    ${textField('CSS id', block.id, (v) => patch({ id: v || undefined }))}
    ${
      withAbbr
        ? textField('Abbr (collapsed glyph, icon-less only)', block.abbr, (v) =>
            patch({ abbr: v || undefined }),
          )
        : nothing
    }
  </details>`;
}

/**
 * Renders the editable fields for one block: its type-specific fields plus the
 * shared Advanced (class/id/abbr) section.
 */
export function blockFields(
  block: SidebarBlock,
  patch: Patch,
  ctx?: ValidationCtx,
): TemplateResult {
  const withAbbr = block.type === 'item' || block.type === 'category';
  return html`${blockTypeFields(block, patch, ctx)}${advancedFields(block, patch, withAbbr)}`;
}

/**
 * Renders the type-specific fields for one block.
 */
function blockTypeFields(block: SidebarBlock, patch: Patch, ctx?: ValidationCtx): TemplateResult {
  switch (block.type) {
    case 'title':
      return html`
        ${textField('Text', block.text, (v) => patch({ text: v }))}
        ${selectField('Align', block.align, ALIGN_OPTIONS, (v) => patch({ align: v }))}
      `;
    case 'clock':
      return html`
        ${textField(
          'Format (strftime)',
          block.format,
          (v) => patch({ format: v || undefined }),
          fieldOpts(ctx, 'format', validateClockFormat),
        )}
        ${selectField('Collapsed', block.collapsed_format ?? '24h', ['24h', '12h'], (v) =>
          patch({ collapsed_format: v }),
        )}
        ${selectField('Align', block.align, ALIGN_OPTIONS, (v) => patch({ align: v }))}
      `;
    case 'date':
      return html`
        ${textField(
          'Format (strftime)',
          block.format,
          (v) => patch({ format: v || undefined }),
          fieldOpts(ctx, 'format', validateDateFormat),
        )}
        ${selectField('Align', block.align, ALIGN_OPTIONS, (v) => patch({ align: v }))}
      `;
    case 'divider':
      return html`<p class="hint">A horizontal rule. No options.</p>`;
    case 'item':
      return html`
        ${textField('Title', block.title, (v) => patch({ title: v }))}
        ${textField('Icon (mdi:...)', block.icon, (v) => patch({ icon: v || undefined }))}
        ${textField('Entity', block.entity, (v) => patch({ entity: v || undefined }))}
        ${actionFields(block.tap_action as { action?: string }, patch, ctx)}
      `;
    case 'category':
      return html`
        ${textField('Title', block.title, (v) => patch({ title: v }))}
        ${textField('Icon (mdi:...)', block.icon, (v) => patch({ icon: v || undefined }))}
        ${checkboxField('Start collapsed', block.start_collapsed ?? true, (v) =>
          patch({ start_collapsed: v }),
        )}
        ${checkboxField('Guide line', block.guide_line ?? true, (v) => patch({ guide_line: v }))}
      `;
    case 'card':
      return html`
        ${areaField(
          'Card (markdown, or JSON card config)',
          typeof block.card === 'string' ? block.card : JSON.stringify(block.card, null, 2),
          (v) => patch({ card: parseCard(v) }),
          fieldOpts(ctx, 'card', validateCardField),
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
