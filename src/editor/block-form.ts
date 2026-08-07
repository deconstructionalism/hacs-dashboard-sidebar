import type { HomeAssistant } from 'custom-card-helpers';
import { html, nothing, type TemplateResult } from 'lit';

import { runAction } from '../lib/action';
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

/** Tap-action kinds offered by the action editor, with Title Case labels. */
const ACTION_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'None' },
  { value: 'toggle', label: 'Toggle' },
  { value: 'more-info', label: 'More Info' },
  { value: 'navigate', label: 'Navigate' },
  { value: 'url', label: 'URL' },
  { value: 'call-service', label: 'Call Service' },
];

/** Per-action explanation shown under the Tap Action dropdown. */
const TAP_ACTION_HINTS: Record<string, string> = {
  none: 'Nothing happens when this is tapped.',
  toggle: 'Toggles the target entity on or off.',
  'more-info': "Opens the entity's more-info dialog.",
  navigate: 'Navigates to another dashboard path.',
  url: 'Opens a web address in a new tab.',
  'call-service': 'Calls a Home Assistant service.',
};

/** Explanations shown under the tap-action fields. */
const ENTITY_HINT = 'Entity targeted by the toggle and more-info actions.';
const SERVICE_HINT = 'The service to call, written as domain.service.';
const TARGET_ENTITY_HINT = 'Entity the service is called on.';
const NAV_PATH_HINT = 'Dashboard path to open, e.g. /lovelace/home.';
const URL_HINT = 'Web address to open in a new tab.';

/**
 * Renders a labelled single-line text input.
 */
export function textField(
  label: string,
  value: string | undefined,
  onInput: (value: string) => void,
  opts?: FieldOpts,
  description?: string,
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
    ${description ? html`<small class="field-desc">${description}</small>` : nothing}
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

/**
 * Built-in date format patterns offered in the date Format dropdown. Curated to
 * cover the conventions people actually use — US month-first and the day-first
 * order used across most of the world, dotted European style, the ISO 8601
 * standard, plus short/long/full variants of each. Examples for 2026-07-27:
 *   ''               Locale default (follows the browser locale)
 *   %Y-%m-%d         2026-07-27          ISO 8601 (unambiguous)
 *   %-m/%-d/%Y       7/27/2026           US, numeric
 *   %-d/%-m/%Y       27/7/2026           Day-first, numeric (most of the world)
 *   %-d.%-m.%Y       27.7.2026           Dotted (much of Europe)
 *   %b %-d           Jul 27              Short
 *   %a, %b %-d       Mon, Jul 27         Short with weekday
 *   %B %-d, %Y       July 27, 2026       Long, US
 *   %-d %B %Y        27 July 2026        Long, day-first
 *   %A, %B %-d, %Y   Monday, July 27, 2026     Full, US
 *   %A, %-d %B %Y    Monday, 27 July 2026      Full, day-first
 */
export const DATE_PRESETS: string[] = [
  '',
  '%Y-%m-%d',
  '%-m/%-d/%Y',
  '%-d/%-m/%Y',
  '%-d.%-m.%Y',
  '%b %-d',
  '%a, %b %-d',
  '%B %-d, %Y',
  '%-d %B %Y',
  '%A, %B %-d, %Y',
  '%A, %-d %B %Y',
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

/**
 * Hint for fields that resolve to plain text: the value is rendered as text, so
 * only Jinja templating applies (not markdown).
 */
export const TEMPLATE_HINT = 'Use Home Assistant Jinja templates to interpolate values from HA.';

/** Hint for the markdown fields, which render markdown as well as Jinja. */
export const MARKDOWN_HINT =
  'Use Home Assistant markdown with Jinja to interpolate values from HA.';

/** Hint shown under color fields, noting any CSS color or a template works. */
export const COLOR_HINT = 'Any CSS color (hex, rgb, var(--…)); a Jinja template also works.';

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
  description?: string,
): TemplateResult {
  const id = (value ?? '').trim();
  const states = (hass?.states ?? {}) as Record<
    string,
    { attributes?: { friendly_name?: string } }
  >;
  const entry = id ? states[id] : undefined;
  // Once the value resolves to a real entity, replace the input with a card that
  // shows the id and friendly name and an X to clear it. Until then (while
  // typing), keep the autocomplete input.
  if (entry) {
    return pickedCard(label, id, entry.attributes?.friendly_name, () => onChange(''), description);
  }
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
    ${description ? html`<small class="field-desc">${description}</small>` : nothing}
  </label>`;
}

/**
 * Renders a resolved-selection card: the id over its (optional) friendly name,
 * with a clear button and optional explanation. Used in place of the input once
 * an entity or service value resolves to a real one.
 */
function pickedCard(
  label: string,
  id: string,
  name: string | undefined,
  onClear: () => void,
  description?: string,
): TemplateResult {
  return html`<div class="field">
    <span>${label}</span>
    <div class="field-picked">
      <div class="field-picked-text">
        <span class="field-picked-id">${id}</span>
        ${name ? html`<span class="field-picked-name">${name}</span>` : nothing}
      </div>
      <button
        type="button"
        class="field-picked-clear"
        title="Clear"
        aria-label="Clear"
        @click=${onClear}
      >
        ✕
      </button>
    </div>
    ${description ? html`<small class="field-desc">${description}</small>` : nothing}
  </div>`;
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
 * The localized description for a service, which HA keeps in the lazily-loaded
 * `services` translation category rather than on the service registry entry.
 * Falls back to any registry name/description.
 */
function serviceDescription(
  hass: HomeAssistant | undefined,
  domain: string,
  service: string,
): string | undefined {
  const localized = hass?.localize?.(`component.${domain}.services.${service}.description`);
  const entry = (
    hass?.services as
      Record<string, Record<string, { name?: string; description?: string }>> | undefined
  )?.[domain]?.[service];
  return localized || entry?.description || entry?.name || undefined;
}

/**
 * Renders a service field: a native text input backed by the shared service
 * `<datalist>`, autocompleting `domain.service` while keeping the plain input
 * look. Once the value resolves to a real service it becomes a card (id over the
 * service description) with a clear button. {@link serviceDatalist} must be
 * rendered once in the same tree.
 */
export function serviceField(
  label: string,
  value: string | undefined,
  onInput: (value: string) => void,
  opts?: FieldOpts,
  hass?: HomeAssistant,
  description?: string,
): TemplateResult {
  const id = (value ?? '').trim();
  const [domain, service] = id.split('.');
  const services = (hass?.services ?? {}) as Record<
    string,
    Record<string, { name?: string; description?: string }>
  >;
  const entry = domain && service ? services[domain]?.[service] : undefined;
  if (entry) {
    return pickedCard(
      label,
      id,
      serviceDescription(hass, domain, service),
      () => onInput(''),
      description,
    );
  }
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
    ${description ? html`<small class="field-desc">${description}</small>` : nothing}
  </label>`;
}

/**
 * Builds the shared service `<datalist>` (every `domain.service`) from the
 * current Home Assistant service registry. Rendered once by the editor; every
 * {@link serviceField} references it by {@link SERVICE_DATALIST_ID}.
 */
export function serviceDatalist(hass?: HomeAssistant): TemplateResult {
  const services = (hass?.services ?? {}) as Record<string, Record<string, unknown>>;
  const options: Array<{ id: string; label?: string }> = [];
  for (const domain of Object.keys(services).sort()) {
    for (const service of Object.keys(services[domain]).sort()) {
      options.push({
        id: `${domain}.${service}`,
        label: serviceDescription(hass, domain, service),
      });
    }
  }
  return html`<datalist id=${SERVICE_DATALIST_ID}>
    ${options.map((o) => html`<option value=${o.id} label=${o.label ?? nothing}></option>`)}
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
  extra?: { description?: string; mono?: boolean; autosize?: boolean; minRows?: number },
): TemplateResult {
  const minRows = extra?.minRows ?? 4;
  const cls = [extra?.mono ? 'mono' : '', extra?.autosize ? 'autosize' : '']
    .filter(Boolean)
    .join(' ');
  // With `.autosize` the CSS grows the box to fit the content; `field-sizing`
  // ignores `rows` for the minimum, so pin it with a min-height of `minRows`
  // lines (plus the 12px padding + 2px border of the box). Otherwise rows is a
  // fixed height.
  const style = extra?.autosize ? `min-height: calc(${minRows}lh + 14px)` : undefined;
  return html`<label class="field ${opts?.error ? 'invalid' : ''}">
    <span>${label}</span>
    <textarea
      class=${cls || nothing}
      rows=${minRows}
      style=${style ?? nothing}
      .value=${value}
      @input=${(e: Event) => onInput((e.target as HTMLTextAreaElement).value)}
      @blur=${(e: Event) => opts?.onBlur?.((e.target as HTMLTextAreaElement).value)}
    ></textarea>
    ${opts?.error ? html`<span class="field-error">${opts.error}</span>` : nothing}
    ${extra?.description ? html`<small class="field-desc">${extra.description}</small>` : nothing}
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
  opts?: { disabled?: boolean; description?: string },
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
    ${opts?.description ? html`<small class="field-desc">${opts.description}</small>` : nothing}
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

/**
 * Display labels for block types where title-casing the id is not enough.
 * Kept empty on purpose: every label matches the YAML `type` (Card, Markdown,
 * ...) so the UI and the config use the same words.
 */
const TYPE_LABELS: Partial<Record<BlockType, string>> = {};

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
 * Renders a color field as a template code editor (like the Text Template
 * field), so a CSS color or a Jinja template can be entered with entity
 * autocompletion. No color-swatch picker.
 */
export function colorTemplateField(
  label: string,
  value: string | undefined,
  onInput: (value: string) => void,
  hass?: HomeAssistant,
): TemplateResult {
  return codeField(label, value, onInput, hass, {
    entities: true,
    description: COLOR_HINT,
  });
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
 * Renders one action editor (`key` is `tap_action`/`hold_action`/
 * `double_tap_action`) inside a collapsed-by-default section titled `summary`,
 * above the Advanced section.
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
  ctx: ValidationCtx | undefined,
  hass: HomeAssistant | undefined,
  key: string,
  summary: string,
  entity?: string,
): TemplateResult {
  const kind = action?.action ?? 'none';
  const set = (partial: Record<string, unknown>): void =>
    patch({ [key]: { ...action, action: kind, ...partial } });
  // toggle/more-info/call-service actions can be safely fired to test them
  // (none/navigate/url are skipped). Only offer the button when it has what it
  // needs: an entity for toggle/more-info (the action's own or the element's),
  // or a service for call-service.
  const canTest =
    hass !== undefined &&
    ((kind === 'toggle' || kind === 'more-info' ? !!(action.entity ?? entity) : false) ||
      (kind === 'call-service' ? !!action.service : false));
  return html`<details class="advanced">
    <summary>${summary}</summary>
    ${selectField(
      'Action Type',
      kind,
      ACTION_OPTIONS,
      (v) => patch({ [key]: { ...action, action: v } }),
      { description: TAP_ACTION_HINTS[kind] },
    )}
    ${
      kind === 'navigate'
        ? textField(
            'Navigation Path',
            action.navigation_path,
            (v) => set({ navigation_path: v }),
            undefined,
            NAV_PATH_HINT,
          )
        : nothing
    }
    ${
      kind === 'url'
        ? textField('URL', action.url_path, (v) => set({ url_path: v }), undefined, URL_HINT)
        : nothing
    }
    ${
      kind === 'toggle' || kind === 'more-info'
        ? entityField(
            'Entity',
            action.entity,
            (v) => set({ entity: v || undefined }),
            hass,
            ENTITY_HINT,
          )
        : nothing
    }
    ${
      kind === 'call-service'
        ? html`
            ${serviceField(
              'Service',
              action.service,
              (v) => set({ service: v }),
              fieldOpts(ctx, `${key}.service`, validateService),
              hass,
              SERVICE_HINT,
            )}
            ${entityField(
              'Target Entity',
              action.entity,
              (v) => set({ entity: v || undefined }),
              hass,
              TARGET_ENTITY_HINT,
            )}
            ${areaField(
              'Service Data',
              action.data ? JSON.stringify(action.data, null, 2) : '',
              (v) => {
                // Keep the typed text until it parses, so partial JSON is not
                // wiped or reformatted mid-edit; clear only when emptied.
                if (!v.trim()) {
                  set({ data: undefined });
                  return;
                }
                const parsed = parseJson(v);
                if (parsed !== undefined) {
                  set({ data: parsed });
                }
              },
              fieldOpts(ctx, `${key}.data`, validateJsonField),
              { description: 'Must be valid JSON.', mono: true, autosize: true, minRows: 3 },
            )}
          `
        : nothing
    }
    ${
      canTest
        ? html`<button
            type="button"
            class="add-btn"
            @click=${(e: Event) => runAction(e.currentTarget as HTMLElement, hass!, action, entity)}
          >
            Test Action
          </button>`
        : nothing
    }
  </details>`;
}

/**
 * Renders the editable fields for one footer button, applying edits via patch.
 */
export function footerButtonFields(
  btn: {
    icon?: string;
    icon_color?: string;
    title?: string;
    entity?: string;
    class?: string;
    id?: string;
    card_mod?: Record<string, unknown>;
    tap_action?: { action?: string };
    active_highlight?: boolean;
  },
  patch: Patch,
  ctx?: ValidationCtx,
  hass?: HomeAssistant,
): TemplateResult {
  return html`
    ${iconField('Icon Template', btn.icon, (v) => patch({ icon: v }), hass, TEMPLATE_HINT)}
    ${colorTemplateField('Icon Color Template', btn.icon_color, (v) => patch({ icon_color: v || undefined }), hass)}
    ${codeField('Title Template', btn.title, (v) => patch({ title: v || undefined }), hass, {
      entities: true,
      icons: true,
      description: TEMPLATE_HINT,
    })}
    ${entityField('Entity', btn.entity, (v) => patch({ entity: v || undefined }), hass, ENTITY_HINT)}
    ${actionSections(btn as unknown as Record<string, unknown>, patch, ctx, hass)}
    <details class="advanced">
      <summary>Advanced</summary>
      ${navHighlightField(btn, patch)}
      ${cardModField(btn.card_mod, (v) => patch({ card_mod: v }), CARD_MOD_ELEMENT_HINT)}
      ${cardModInstalled() ? elementClassRef('footer-button') : nothing}
    </details>
  `;
}

/**
 * Renders the Timezone and Custom Format fields for a clock or date, shown in
 * the Advanced section.
 */
function clockDateAdvanced(
  block: { type: string; format?: string; timezone?: string },
  patch: Patch,
): TemplateResult {
  const isClock = block.type === 'clock';
  const raw = (block.format ?? '').trim();
  const presets = isClock ? CLOCK_PRESET_VALUES : DATE_PRESET_VALUES;
  const custom = raw !== '' && !presets.has(raw);
  return html`
    ${timezoneField(block.timezone, (v) => patch({ timezone: v || undefined }))}
    ${formatField(
      'Custom Format',
      custom ? raw : '',
      (v) => patch({ format: v.trim() || undefined }),
      undefined,
      isClock ? TIME_HELP : DATE_HELP,
      isClock
        ? 'Optional strftime pattern; overrides the Format dropdown, e.g. %-I:%M:%S %p.'
        : 'Optional strftime pattern; overrides the Format dropdown, e.g. %A, %B %-d.',
    )}
  `;
}

/**
 * Renders the CSS class (and, for items/categories, abbr) hook plus the card-mod
 * field under a native collapsible Advanced section. `extra` is placed above the
 * hooks (e.g. the clock/date Timezone and Custom Format fields).
 */
function advancedFields(
  block: {
    type?: string;
    class?: string;
    abbr?: string;
    icon?: unknown;
    card_mod?: Record<string, unknown>;
    tap_action?: { action?: string };
    active_highlight?: boolean;
  },
  patch: Patch,
  withAbbr: boolean,
  extra: TemplateResult | typeof nothing = nothing,
): TemplateResult {
  return html`<details class="advanced">
    <summary>Advanced</summary>
    ${extra} ${navHighlightField(block, patch)}
    ${
      withAbbr
        ? textField(
            'Abbreviation',
            block.abbr,
            (v) => patch({ abbr: v || undefined }),
            undefined,
            'The glyph shown in the collapsed view, used only when no icon is set.',
          )
        : nothing
    }
    ${cardModField(block.card_mod, (v) => patch({ card_mod: v }), CARD_MOD_ELEMENT_HINT)}
    ${cardModInstalled() ? elementClassRef(block.type ?? 'item') : nothing}
  </details>`;
}

/**
 * Renders the "Highlight when active" toggle, shown only when the element's tap
 * action navigates (the highlight marks the element whose target is the open
 * page). Default on; unchecking stores `active_highlight: false`.
 */
function navHighlightField(
  el: { tap_action?: { action?: string }; active_highlight?: boolean },
  patch: Patch,
): TemplateResult | typeof nothing {
  if (el.tap_action?.action !== 'navigate') {
    return nothing;
  }
  return checkboxField(
    'Highlight When Active',
    el.active_highlight ?? true,
    (v) => patch({ active_highlight: v ? undefined : false }),
    'Highlight this while its navigate target is the current page.',
  );
}

/** The card-mod integration's repository, linked from the Card Mod fields. */
const CARD_MOD_URL = 'https://github.com/thomasloven/lovelace-card-mod';

/** Targetable `dashboard-sidebar-*` selectors for each element type. */
const ELEMENT_CLASSES: Record<string, Array<{ sel: string; desc: string }>> = {
  title: [{ sel: '.dashboard-sidebar-title', desc: 'The title element' }],
  clock: [{ sel: '.dashboard-sidebar-clock', desc: 'The clock element' }],
  date: [{ sel: '.dashboard-sidebar-date', desc: 'The date element' }],
  divider: [{ sel: '.dashboard-sidebar-divider', desc: 'The divider line' }],
  item: [
    { sel: '.dashboard-sidebar-item', desc: 'The item row' },
    { sel: '.dashboard-sidebar-item-icon', desc: 'The item icon' },
    { sel: '.dashboard-sidebar-item-label', desc: 'The item label text' },
    { sel: '.dashboard-sidebar-initials', desc: 'The collapsed glyph (icon-less)' },
  ],
  category: [
    { sel: '.dashboard-sidebar-category', desc: 'The category group' },
    { sel: '.dashboard-sidebar-category-header', desc: 'The category header row' },
    { sel: '.dashboard-sidebar-category-items', desc: 'The items list' },
    { sel: '.dashboard-sidebar-chevron', desc: 'The expand chevron' },
    { sel: '.dashboard-sidebar-item', desc: 'A child item row' },
    { sel: '.dashboard-sidebar-popover', desc: 'The collapsed popover' },
  ],
  markdown: [{ sel: '.dashboard-sidebar-markdown', desc: 'The text (markdown) block' }],
  card: [{ sel: '.dashboard-sidebar-content', desc: 'The manual card wrapper' }],
  'footer-button': [
    { sel: '.dashboard-sidebar-footer-btn', desc: 'The footer button' },
    { sel: '.dashboard-sidebar-footer-icon', desc: 'The footer button icon' },
  ],
};

/**
 * Renders a collapsed reference of the `dashboard-sidebar-*` selectors relevant
 * to one element type, for use in its Advanced section. Empty for an unknown
 * type.
 */
export function elementClassRef(type: string): TemplateResult {
  const classes = ELEMENT_CLASSES[type];
  if (!classes) {
    return html``;
  }
  return html`<details class="advanced class-ref">
    <summary>Targetable CSS classes</summary>
    <div class="class-ref-list">
      ${classes.map(
        (c) => html`<div class="class-ref-row"><code>${c.sel}</code><span>${c.desc}</span></div>`,
      )}
    </div>
  </details>`;
}

/** Note shown on a per-element Card Mod, whose styles are scoped to that element. */
const CARD_MOD_ELEMENT_HINT =
  'Scoped to this element. Target it directly with its class (e.g. .dashboard-sidebar-title) or :scope.';

/**
 * Whether the card-mod integration is installed (its custom element is defined).
 * The CSS-class hook and the targetable-class reference only matter with
 * card-mod: the sidebar renders in shadow DOM, so nothing but card-mod (or an
 * equivalent shadow-piercing styler) can target those classes. When it is
 * absent we hide both and let the Card Mod field's install prompt stand alone.
 */
export const cardModInstalled = (): boolean => !!customElements.get('card-mod');

/**
 * Validates a card-mod value: it must be a mapping (`{ style: … }`), which is
 * the shape the integration expects. Returns an error message, or null.
 */
function cardModError(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return 'Card Mod must be a mapping, e.g. "style: |".';
  }
  return null;
}

/**
 * Renders the Card Mod YAML field: a `{ style, … }` object passed to the
 * card-mod integration to style this element (or the sidebar). When card-mod is
 * not installed the field is hidden and replaced with a prompt to install it,
 * since the config would otherwise silently do nothing. `hint` adds an extra
 * note (e.g. the per-element scope warning).
 */
export function cardModField(
  value: Record<string, unknown> | undefined,
  onChange: (value: Record<string, unknown> | undefined) => void,
  hint?: string,
): TemplateResult {
  const link = html`<a href=${CARD_MOD_URL} target="_blank" rel="noopener noreferrer">card-mod</a>`;
  if (!customElements.get('card-mod')) {
    return html`<div class="field card-mod-missing">
      <span>Card Mod YAML</span>
      <small class="field-desc">
        Install ${link} (available in HACS) to customize styles with CSS.
      </small>
    </div>`;
  }
  const err = cardModError(value);
  return html`
    ${yamlField('Card Mod YAML', value, (v) => onChange(v as Record<string, unknown>))}
    ${err ? html`<span class="field-error">${err}</span>` : nothing}
    <small class="field-desc card-mod-hint">
      Customize styles with CSS via ${link}. ${hint ?? ''}
    </small>
  `;
}

/** Block types that carry tap/hold/double-tap actions. */
const ACTION_TYPES = new Set(['title', 'clock', 'date', 'item']);

/** The action keys and their section titles, in display order. */
const ACTION_SECTIONS: Array<{ key: string; summary: string }> = [
  { key: 'tap_action', summary: 'Tap Action' },
  { key: 'hold_action', summary: 'Hold Action' },
  { key: 'double_tap_action', summary: 'Double Tap Action' },
];

/**
 * Renders the Tap/Hold/Double Tap Action sections for a block or footer button.
 */
export function actionSections(
  el: Record<string, unknown>,
  patch: Patch,
  ctx: ValidationCtx | undefined,
  hass: HomeAssistant | undefined,
): TemplateResult {
  const entity = typeof el.entity === 'string' ? el.entity : undefined;
  return html`${ACTION_SECTIONS.map(({ key, summary }) =>
    actionFields((el[key] as { action?: string }) ?? {}, patch, ctx, hass, key, summary, entity),
  )}`;
}

/**
 * Renders the editable fields for one block: its type-specific fields, the
 * Tap/Hold/Double Tap Action sections (for the types that support them), and the
 * shared Advanced (Timezone/Custom Format for clock/date, plus class/id/abbr).
 */
export function blockFields(
  block: SidebarBlock,
  patch: Patch,
  ctx?: ValidationCtx,
  hass?: HomeAssistant,
): TemplateResult {
  const withAbbr = block.type === 'item' || block.type === 'category';
  const action = ACTION_TYPES.has(block.type ?? '')
    ? actionSections(block as unknown as Record<string, unknown>, patch, ctx, hass)
    : nothing;
  const advancedExtra =
    block.type === 'clock' || block.type === 'date' ? clockDateAdvanced(block, patch) : nothing;
  return html`${blockTypeFields(block, patch, hass)}${action}${advancedFields(
    block,
    patch,
    withAbbr,
    advancedExtra,
  )}`;
}

/**
 * Renders the type-specific fields for one block.
 */
function blockTypeFields(block: SidebarBlock, patch: Patch, hass?: HomeAssistant): TemplateResult {
  switch (block.type) {
    case 'title':
      return html`
        ${codeField('Text Template', block.text, (v) => patch({ text: v }), hass, {
          entities: true,
          icons: true,
          description: TEMPLATE_HINT,
        })}
        ${selectField('Align', block.align, ALIGN_OPTIONS, (v) => patch({ align: v }))}
        ${colorTemplateField('Text Color Template', block.text_color, (v) => patch({ text_color: v || undefined }), hass)}
      `;
    case 'clock': {
      // The Format dropdown writes the single `format` key; Timezone and the
      // Custom Format override live in the Advanced section. A pattern that is
      // not one of the presets is custom, which disables the dropdown.
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
        ${selectField('Align', block.align, ALIGN_OPTIONS, (v) => patch({ align: v }))}
        ${colorTemplateField('Text Color Template', block.text_color, (v) => patch({ text_color: v || undefined }), hass)}
      `;
    }
    case 'date': {
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
        ${selectField('Align', block.align, ALIGN_OPTIONS, (v) => patch({ align: v }))}
        ${colorTemplateField('Text Color Template', block.text_color, (v) => patch({ text_color: v || undefined }), hass)}
      `;
    }
    case 'divider':
      return html`
        ${colorTemplateField('Color Template', block.color, (v) => patch({ color: v || undefined }), hass)}
      `;
    case 'item':
      return html`
        ${codeField('Title Template', block.title, (v) => patch({ title: v }), hass, {
          entities: true,
          icons: true,
          description: TEMPLATE_HINT,
        })}
        ${iconField('Icon Template', block.icon, (v) => patch({ icon: v || undefined }), hass, TEMPLATE_HINT)}
        ${entityField('Entity', block.entity, (v) => patch({ entity: v || undefined }), hass, ENTITY_HINT)}
        ${colorTemplateField('Text Color Template', block.text_color, (v) => patch({ text_color: v || undefined }), hass)}
        ${colorTemplateField('Icon Color Template', block.icon_color, (v) => patch({ icon_color: v || undefined }), hass)}
      `;
    case 'category':
      return html`
        ${codeField('Title Template', block.title, (v) => patch({ title: v }), hass, {
          entities: true,
          icons: true,
          description: TEMPLATE_HINT,
        })}
        ${iconField('Icon Template', block.icon, (v) => patch({ icon: v || undefined }), hass, TEMPLATE_HINT)}
        ${colorTemplateField('Text Color Template', block.text_color, (v) => patch({ text_color: v || undefined }), hass)}
        ${colorTemplateField('Icon Color Template', block.icon_color, (v) => patch({ icon_color: v || undefined }), hass)}
        ${
          // Store undefined at the default (true) so toggling back to it drops
          // the key and leaves the config identical to the start state.
          checkboxField(
            'Start Collapsed',
            block.start_collapsed ?? true,
            (v) => patch({ start_collapsed: v ? undefined : false }),
            "Start this group collapsed; its items stay hidden under the header until it's expanded.",
          )
        }
        ${checkboxField(
          'Guide Line',
          block.guide_line ?? true,
          (v) => patch({ guide_line: v ? undefined : false }),
          "Draw a vertical line beside the group's items to visually connect them.",
        )}
      `;
    case 'markdown':
      return html`
        ${codeField('Content Template', block.content, (v) => patch({ content: v }), hass, {
          entities: true,
          icons: true,
          description: MARKDOWN_HINT,
        })}
        ${selectField('Align', block.align, ALIGN_OPTIONS, (v) => patch({ align: v }))}
        ${colorTemplateField('Text Color Template', block.text_color, (v) => patch({ text_color: v || undefined }), hass)}
      `;
    case 'card':
      return html`${yamlField('YAML Config', block.card, (v) => patch({ card: v }))}`;
    default:
      return html``;
  }
}
