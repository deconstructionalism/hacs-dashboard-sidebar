import type { HomeAssistant } from 'custom-card-helpers';
import { html, nothing, type TemplateResult } from 'lit';

import { formatClock, formatDate } from '../lib/format';
import type { BlockType, SidebarBlock } from '../lib/types';

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

/** strftime tokens supported in a clock format, for the custom-format help. */
export const TIME_HELP: Array<{ code: string; desc: string }> = [
  { code: '%H', desc: 'Hour, 24-hour (00-23)' },
  { code: '%I', desc: 'Hour, 12-hour (01-12)' },
  { code: '%M', desc: 'Minute (00-59)' },
  { code: '%S', desc: 'Second (00-59)' },
  { code: '%p', desc: 'AM or PM' },
  { code: '%P', desc: 'am or pm (lowercase)' },
  { code: '%Z', desc: 'Time zone name' },
  { code: '%z', desc: 'UTC offset (+0100)' },
  { code: '%-', desc: 'Prefix to drop leading zero (%-I)' },
  { code: '%%', desc: 'A literal percent sign' },
];

/** Built-in date format patterns offered in the date Format dropdown. */
export const DATE_PRESETS: string[] = [
  '',
  '%A, %B %-d',
  '%A, %B %-d, %Y',
  '%B %-d, %Y',
  '%b %-d',
  '%-m/%-d/%Y',
  '%Y-%m-%d',
];

/** Pattern values that map to a date preset, for detecting a custom pattern. */
export const DATE_PRESET_VALUES = new Set(DATE_PRESETS.filter(Boolean));

/** The default clock pattern (24-hour, no seconds) when `format` is empty. */
export const DEFAULT_CLOCK_FORMAT = '%H:%M';

/** Built-in time patterns offered in the clock Format dropdown. */
export const CLOCK_PRESETS: string[] = ['%-I:%M %p', '%H:%M', '%-I:%M:%S %p', '%H:%M:%S'];

/** Pattern values that map to a clock preset, for detecting a custom pattern. */
export const CLOCK_PRESET_VALUES = new Set(CLOCK_PRESETS);

/**
 * Builds the clock Format dropdown options, each labelled with the current time
 * rendered in that pattern.
 */
function clockFormatOptions(): SelectOption[] {
  const now = new Date();
  const loc = navigator.language;
  return CLOCK_PRESETS.map((value) => ({ value, label: formatClock(now, value, loc) }));
}

/**
 * Builds the date Format dropdown options, each labelled with today's date
 * rendered in that preset (the empty preset shows the locale default).
 */
function dateFormatOptions(): SelectOption[] {
  const now = new Date();
  const loc = navigator.language;
  return DATE_PRESETS.map((value) => ({ value, label: formatDate(now, value || 'locale', loc) }));
}

/**
 * Renders an optional time-zone dropdown listing every available IANA zone, with
 * a system-zone default.
 */
export function timezoneField(
  value: string | undefined,
  onChange: (value: string) => void,
): TemplateResult {
  const supported = (Intl as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
  const zones = typeof supported === 'function' ? supported('timeZone') : [];
  const options: SelectOption[] = [
    { label: 'System Timezone', value: '' },
    ...zones.map((z) => ({ label: z, value: z })),
  ];
  return selectField('Timezone', value ?? '', options, onChange);
}

/** strftime tokens supported in a date format, for the format field's help. */
export const DATE_HELP: Array<{ code: string; desc: string }> = [
  { code: '%Y', desc: 'Year, 4-digit (2026)' },
  { code: '%y', desc: 'Year, 2-digit (26)' },
  { code: '%m', desc: 'Month number (01-12)' },
  { code: '%B', desc: 'Month name (July)' },
  { code: '%b', desc: 'Month, short (Jul)' },
  { code: '%d', desc: 'Day of month (01-31)' },
  { code: '%e', desc: 'Day of month, space-padded' },
  { code: '%A', desc: 'Weekday name (Monday)' },
  { code: '%a', desc: 'Weekday, short (Mon)' },
  { code: '%j', desc: 'Day of year (001-366)' },
  { code: '%-', desc: 'Prefix to drop leading zero (%-d)' },
  { code: '%%', desc: 'A literal percent sign' },
];

/**
 * Renders a format (strftime) field: a labelled text input with an info button
 * that reveals the supported tokens, and an explanation below the input.
 */
export function formatField(
  label: string,
  value: string | undefined,
  onInput: (value: string) => void,
  opts: FieldOpts | undefined,
  tokens: Array<{ code: string; desc: string }>,
  description: string,
): TemplateResult {
  return html`<div class="field format-field ${opts?.error ? 'invalid' : ''}">
    <span class="field-head">
      ${label}
      <details class="format-help">
        <summary title="Format tokens" aria-label="Format tokens">
          <ha-icon icon="mdi:information-outline"></ha-icon>
        </summary>
        <div class="format-help-pop">
          ${tokens.map(
            (t) =>
              html`<div class="format-token"><code>${t.code}</code><span>${t.desc}</span></div>`,
          )}
        </div>
      </details>
    </span>
    <input
      type="text"
      .value=${value ?? ''}
      @input=${(e: Event) => onInput((e.target as HTMLInputElement).value)}
      @blur=${(e: Event) => opts?.onBlur?.((e.target as HTMLInputElement).value)}
    />
    ${opts?.error ? html`<span class="field-error">${opts.error}</span>` : nothing}
    <small class="field-desc">${description}</small>
  </div>`;
}

/**
 * Renders a field backed by Home Assistant's `<ha-code-editor>` (CodeMirror)
 * when it and `hass` are available, giving inline autocomplete for Jinja
 * template helpers, entity ids, and/or mdi icons. Falls back to a plain text
 * input otherwise (e.g. outside HA, or in tests).
 */
export function codeField(
  label: string,
  value: string | undefined,
  onInput: (value: string) => void,
  hass?: HomeAssistant,
  opts?: {
    mode?: string;
    entities?: boolean;
    icons?: boolean;
    error?: string;
    description?: string;
  },
): TemplateResult {
  const desc = opts?.description
    ? html`<small class="field-desc">${opts.description}</small>`
    : nothing;
  const error = opts?.error ? html`<span class="field-error">${opts.error}</span>` : nothing;
  if (hass && customElements.get('ha-code-editor')) {
    return html`<div class="field code-field ${opts?.error ? 'invalid' : ''}">
      <span>${label}</span>
      <ha-code-editor
        .hass=${hass}
        .value=${value ?? ''}
        .mode=${opts?.mode ?? 'jinja2'}
        .autocompleteEntities=${opts?.entities ?? false}
        .autocompleteIcons=${opts?.icons ?? false}
        dir="ltr"
        @value-changed=${(e: CustomEvent<{ value: string }>) => onInput(e.detail.value)}
      ></ha-code-editor>
      ${error}${desc}
    </div>`;
  }
  return html`<label class="field ${opts?.error ? 'invalid' : ''}">
    <span>${label}</span>
    <input
      type="text"
      .value=${value ?? ''}
      @input=${(e: Event) => onInput((e.target as HTMLInputElement).value)}
    />
    ${error}${desc}
  </label>`;
}

/** Shared hint for fields that accept Home Assistant markdown and Jinja. */
export const TEMPLATE_HINT =
  'Use Home Assistant markdown with Jinja to style and interpolate values from HA.';

/** id of the shared entity `<datalist>` the editor renders once per modal. */
export const ENTITY_DATALIST_ID = 'dsb-entity-options';

/**
 * Renders an entity field: a native text input backed by the shared entity
 * `<datalist>`, so it autocompletes existing `domain.name` ids while matching
 * the plain look of the other inputs. When a value is set, its friendly name is
 * shown below with a clear button. {@link entityDatalist} must be rendered once
 * in the same tree.
 */
export function entityField(
  label: string,
  value: string | undefined,
  onChange: (value: string) => void,
  hass?: HomeAssistant,
): TemplateResult {
  const id = (value ?? '').trim();
  const states = (hass?.states ?? {}) as Record<
    string,
    { attributes?: { friendly_name?: string } }
  >;
  const name = id ? (states[id]?.attributes?.friendly_name ?? id) : '';
  return html`<label class="field">
    <span>${label}</span>
    <input
      type="text"
      list=${ENTITY_DATALIST_ID}
      autocomplete="off"
      spellcheck="false"
      placeholder="domain.entity"
      .value=${value ?? ''}
      @input=${(e: Event) => onChange((e.target as HTMLInputElement).value)}
    />
    ${
      id
        ? html`<div class="field-selected">
            <span>${name}</span>
            <button
              type="button"
              class="field-clear"
              title="Clear"
              aria-label="Clear"
              @click=${() => onChange('')}
            >
              ✕
            </button>
          </div>`
        : nothing
    }
  </label>`;
}

/**
 * Builds the shared entity `<datalist>` from the current Home Assistant states,
 * with each entity's friendly name as the option label. Rendered once by the
 * editor; every {@link entityField} references it by {@link ENTITY_DATALIST_ID}.
 */
export function entityDatalist(hass?: HomeAssistant): TemplateResult {
  const states = (hass?.states ?? {}) as Record<
    string,
    { attributes?: { friendly_name?: string } }
  >;
  const ids = Object.keys(states).sort();
  return html`<datalist id=${ENTITY_DATALIST_ID}>
    ${ids.map((id) => {
      const name = states[id]?.attributes?.friendly_name;
      return html`<option value=${id} label=${name ?? nothing}></option>`;
    })}
  </datalist>`;
}

/** id of the shared service `<datalist>` the editor renders once per modal. */
export const SERVICE_DATALIST_ID = 'dsb-service-options';

/**
 * Renders a service field: a native text input backed by the shared service
 * `<datalist>`, autocompleting `domain.service` while keeping the plain input
 * look. {@link serviceDatalist} must be rendered once in the same tree.
 */
export function serviceField(
  label: string,
  value: string | undefined,
  onInput: (value: string) => void,
  opts?: FieldOpts,
): TemplateResult {
  return html`<label class="field ${opts?.error ? 'invalid' : ''}">
    <span>${label}</span>
    <input
      type="text"
      list=${SERVICE_DATALIST_ID}
      autocomplete="off"
      spellcheck="false"
      placeholder="domain.service"
      .value=${value ?? ''}
      @input=${(e: Event) => onInput((e.target as HTMLInputElement).value)}
      @blur=${(e: Event) => opts?.onBlur?.((e.target as HTMLInputElement).value)}
    />
    ${opts?.error ? html`<span class="field-error">${opts.error}</span>` : nothing}
  </label>`;
}

/**
 * Builds the shared service `<datalist>` (every `domain.service`) from the
 * current Home Assistant service registry. Rendered once by the editor; every
 * {@link serviceField} references it by {@link SERVICE_DATALIST_ID}.
 */
export function serviceDatalist(hass?: HomeAssistant): TemplateResult {
  const services = (hass?.services ?? {}) as Record<string, Record<string, unknown>>;
  const ids: string[] = [];
  for (const domain of Object.keys(services).sort()) {
    for (const service of Object.keys(services[domain]).sort()) {
      ids.push(`${domain}.${service}`);
    }
  }
  return html`<datalist id=${SERVICE_DATALIST_ID}>
    ${ids.map((id) => html`<option value=${id}></option>`)}
  </datalist>`;
}

/**
 * Renders an icon field: a code editor with mdi-icon (and template) autocomplete
 * when available, else a plain text input.
 */
export function iconField(
  label: string,
  value: string | undefined,
  onInput: (value: string) => void,
  hass?: HomeAssistant,
  description?: string,
): TemplateResult {
  return codeField(label, value, onInput, hass, { icons: true, description });
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
 * Renders a YAML editor for a card config using Home Assistant's
 * `<ha-yaml-editor>` (syntax highlighting and parse validation) when available,
 * emitting the parsed object on each valid edit. Falls back to a plain textarea
 * that accepts JSON, used in tests and outside HA.
 */
export function yamlField(
  label: string,
  value: unknown,
  onChange: (value: unknown) => void,
): TemplateResult {
  if (customElements.get('ha-yaml-editor')) {
    return html`<div class="field yaml-field">
      <span>${label}</span>
      <ha-yaml-editor
        .defaultValue=${value}
        @value-changed=${(e: CustomEvent<{ value: unknown; isValid: boolean }>) => {
          if (e.detail.isValid) {
            onChange(e.detail.value);
          }
        }}
      ></ha-yaml-editor>
    </div>`;
  }
  return areaField(label, value === undefined ? '' : JSON.stringify(value, null, 2), (v) => {
    const trimmed = v.trim();
    if (!trimmed) {
      onChange(undefined);
      return;
    }
    try {
      onChange(JSON.parse(trimmed));
    } catch {
      // Keep the last valid value while the JSON is mid-edit.
    }
  });
}

/** A dropdown option: a raw string (shown title-cased) or an explicit label. */
export type SelectOption = string | { label: string; value: string };

/**
 * Renders a labelled dropdown. String options are shown title-cased; object
 * options carry their own display label. Can be disabled.
 */
export function selectField(
  label: string,
  value: string | undefined,
  options: SelectOption[],
  onChange: (value: string) => void,
  opts?: { disabled?: boolean },
): TemplateResult {
  const norm = (o: SelectOption): { label: string; value: string } =>
    typeof o === 'string' ? { label: titleCase(o), value: o } : o;
  return html`<label class="field">
    <span>${label}</span>
    <select
      ?disabled=${opts?.disabled ?? false}
      @change=${(e: Event) => {
        const el = e.target as HTMLSelectElement;
        // Blur before the re-render re-applies `?selected`: mutating the options
        // of the just-used (focused) select is what leaves Chrome needing an
        // extra click to reopen it. Blurring settles it so the next click opens.
        el.blur();
        onChange(el.value);
      }}
    >
      ${options.map((o) => {
        const n = norm(o);
        return html`<option value=${n.value} ?selected=${n.value === value}>${n.label}</option>`;
      })}
    </select>
  </label>`;
}

/**
 * Renders a labelled checkbox. Can be disabled.
 */
export function checkboxField(
  label: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
  description?: string,
  disabled?: boolean,
): TemplateResult {
  return html`<label class="field field-inline">
    <input
      type="checkbox"
      .checked=${checked}
      ?disabled=${disabled ?? false}
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

/** Display labels for block types where title-casing the id is not enough. */
const TYPE_LABELS: Partial<Record<BlockType, string>> = {
  card: 'Manual Card',
  markdown: 'Text',
};

/**
 * Returns the human display label for a block type.
 */
export function blockTypeLabel(type: BlockType): string {
  return TYPE_LABELS[type] ?? titleCase(type);
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
  description?: string,
  warning?: string,
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
    ${warning ? html`<small class="field-warn">${warning}</small>` : nothing}
    ${description ? html`<small class="field-desc">${description}</small>` : nothing}
  </label>`;
}

/**
 * Renders a labelled color field: a native color swatch alongside a free-text
 * input, so any CSS color (hex, rgb, var(), name) can still be typed. The
 * swatch opens the picker via `showPicker()` (cancelling the native open) so it
 * reopens on every click regardless of focus, falling back to the native open
 * where `showPicker` is unavailable.
 */
export function colorField(
  label: string,
  value: string | undefined,
  onInput: (value: string) => void,
  description?: string,
): TemplateResult {
  const swatch = /^#[0-9a-fA-F]{6}$/.test(value ?? '') ? (value as string) : '#000000';
  return html`<div class="field">
    <span>${label}</span>
    <div class="color-row">
      <input
        class="color-swatch"
        type="color"
        aria-label="Pick a color"
        .value=${swatch}
        @click=${(e: Event) => {
          const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
          if (typeof el.showPicker === 'function') {
            e.preventDefault();
            el.showPicker();
          }
        }}
        @input=${(e: Event) => onInput((e.target as HTMLInputElement).value)}
      />
      <input
        type="text"
        .value=${value ?? ''}
        @input=${(e: Event) => onInput((e.target as HTMLInputElement).value)}
      />
    </div>
    ${description ? html`<small class="field-desc">${description}</small>` : nothing}
  </div>`;
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
  hass?: HomeAssistant,
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
        ? entityField('Entity', action.entity, (v) => set({ entity: v || undefined }), hass)
        : nothing
    }
    ${
      kind === 'call-service'
        ? html`
            ${serviceField(
              'Service (domain.service)',
              action.service,
              (v) => set({ service: v }),
              fieldOpts(ctx, 'service', validateService),
            )}
            ${entityField('Target entity', action.entity, (v) => set({ entity: v || undefined }), hass)}
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
  hass?: HomeAssistant,
): TemplateResult {
  return html`
    ${iconField('Icon Template', btn.icon, (v) => patch({ icon: v }), hass, TEMPLATE_HINT)}
    ${codeField('Title Template', btn.title, (v) => patch({ title: v || undefined }), hass, {
      entities: true,
      icons: true,
      description: TEMPLATE_HINT,
    })}
    ${entityField('Entity', btn.entity, (v) => patch({ entity: v || undefined }), hass)}
    ${actionFields(btn.tap_action ?? {}, patch, ctx, hass)}
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
  hass?: HomeAssistant,
): TemplateResult {
  const withAbbr = block.type === 'item' || block.type === 'category';
  return html`${blockTypeFields(block, patch, ctx, hass)}${advancedFields(block, patch, withAbbr)}`;
}

/**
 * Renders the type-specific fields for one block.
 */
function blockTypeFields(
  block: SidebarBlock,
  patch: Patch,
  ctx?: ValidationCtx,
  hass?: HomeAssistant,
): TemplateResult {
  switch (block.type) {
    case 'title':
      return html`
        ${codeField('Text Template', block.text, (v) => patch({ text: v }), hass, {
          entities: true,
          icons: true,
          description: TEMPLATE_HINT,
        })}
        ${selectField('Align', block.align, ALIGN_OPTIONS, (v) => patch({ align: v }))}
      `;
    case 'clock': {
      // Both the Format dropdown and Custom Format write the single `format`
      // key. A pattern that is not one of the presets is treated as custom,
      // which disables the dropdown and shows in the Custom Format field.
      const raw = (block.format ?? '').trim();
      const custom = raw !== '' && !CLOCK_PRESET_VALUES.has(raw);
      return html`
        ${selectField(
          'Format',
          custom ? DEFAULT_CLOCK_FORMAT : raw || DEFAULT_CLOCK_FORMAT,
          clockFormatOptions(),
          (v) => patch({ format: v }),
          { disabled: custom },
        )}
        ${timezoneField(block.timezone, (v) => patch({ timezone: v || undefined }))}
        ${selectField('Align', block.align, ALIGN_OPTIONS, (v) => patch({ align: v }))}
        ${formatField(
          'Custom Format',
          custom ? raw : '',
          (v) => patch({ format: v.trim() || undefined }),
          undefined,
          TIME_HELP,
          'Optional strftime pattern; overrides Format above, e.g. %-I:%M:%S %p.',
        )}
      `;
    }
    case 'date': {
      // Both the Format dropdown and Custom Format write the single `format`
      // key. Any pattern that is not one of the presets is treated as custom.
      const raw = (block.format ?? '').trim();
      const custom = raw !== '' && !DATE_PRESET_VALUES.has(raw);
      return html`
        ${selectField(
          'Format',
          custom ? '' : raw,
          dateFormatOptions(),
          (v) => patch({ format: v || undefined }),
          { disabled: custom },
        )}
        ${timezoneField(block.timezone, (v) => patch({ timezone: v || undefined }))}
        ${selectField('Align', block.align, ALIGN_OPTIONS, (v) => patch({ align: v }))}
        ${formatField(
          'Custom Format',
          custom ? raw : '',
          (v) => patch({ format: v.trim() || undefined }),
          undefined,
          DATE_HELP,
          'Optional strftime pattern; overrides Format above, e.g. %A, %B %-d.',
        )}
      `;
    }
    case 'divider':
      return html`<p class="hint">A horizontal rule. No options.</p>`;
    case 'item':
      return html`
        ${codeField('Title Template', block.title, (v) => patch({ title: v }), hass, {
          entities: true,
          icons: true,
          description: TEMPLATE_HINT,
        })}
        ${iconField('Icon Template', block.icon, (v) => patch({ icon: v || undefined }), hass, TEMPLATE_HINT)}
        ${entityField('Entity', block.entity, (v) => patch({ entity: v || undefined }), hass)}
        ${actionFields(block.tap_action as { action?: string }, patch, ctx, hass)}
      `;
    case 'category':
      return html`
        ${codeField('Title Template', block.title, (v) => patch({ title: v }), hass, {
          entities: true,
          icons: true,
          description: TEMPLATE_HINT,
        })}
        ${iconField('Icon Template', block.icon, (v) => patch({ icon: v || undefined }), hass, TEMPLATE_HINT)}
        ${checkboxField('Start collapsed', block.start_collapsed ?? true, (v) =>
          patch({ start_collapsed: v }),
        )}
        ${checkboxField('Guide line', block.guide_line ?? true, (v) => patch({ guide_line: v }))}
      `;
    case 'markdown':
      return html`
        ${codeField('Content Template', block.content, (v) => patch({ content: v }), hass, {
          entities: true,
          icons: true,
          description: TEMPLATE_HINT,
        })}
        ${selectField('Align', block.align, ALIGN_OPTIONS, (v) => patch({ align: v }))}
      `;
    case 'card':
      return html`${yamlField('YAML Config', block.card, (v) => patch({ card: v }))}`;
    default:
      return html``;
  }
}
