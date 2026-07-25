import type { HomeAssistant } from 'custom-card-helpers';

import type { DashboardSidebarConfig, SidebarEntry } from './types';
import { isCategory } from './types';

const TEMPLATE_RE = /\{\{|\{%|\{#/;

/** True when a string carries a Jinja template and needs server rendering. */
export function isTemplate(value: string | undefined): value is string {
  return typeof value === 'string' && TEMPLATE_RE.test(value);
}

interface RenderResult {
  result: string;
}

interface Subscription {
  value: string;
  unsub?: Promise<() => void>;
}

/**
 * Subscribes to Home Assistant's render_template websocket for each unique
 * template string in the config and caches the latest result. Literals are
 * returned as-is and never subscribed.
 */
export class TemplateManager {
  private _hass?: HomeAssistant;

  private readonly _subs = new Map<string, Subscription>();

  private readonly _onChange: () => void;

  constructor(onChange: () => void) {
    this._onChange = onChange;
  }

  public setHass(hass: HomeAssistant | undefined): void {
    const first = !this._hass;
    this._hass = hass;
    if (first && hass?.connection) {
      this._flush();
    }
  }

  /** Registers every templatable string in the config for subscription. */
  public collect(config: DashboardSidebarConfig): void {
    this.clear();
    const add = (value: string | undefined): void => {
      if (isTemplate(value) && !this._subs.has(value)) {
        this._subs.set(value, { value: '' });
      }
    };
    const addEntry = (entry: SidebarEntry): void => {
      add(entry.title);
      add(entry.icon);
      if (isCategory(entry)) {
        entry.items.forEach((item) => {
          add(item.title);
          add(item.icon);
          add(item.text_color);
          add(item.icon_color);
        });
      } else {
        add(entry.text_color);
        add(entry.icon_color);
      }
    };
    add(config.title);
    config.items.forEach(addEntry);
    this._flush();
  }

  /** Returns the literal, or the cached template result (empty until ready). */
  public resolve(value: string | undefined): string {
    if (value === undefined) {
      return '';
    }
    if (!isTemplate(value)) {
      return value;
    }
    return this._subs.get(value)?.value ?? '';
  }

  public clear(): void {
    this._subs.forEach((sub) => {
      sub.unsub?.then((unsub) => unsub()).catch(() => undefined);
    });
    this._subs.clear();
  }

  private _flush(): void {
    const hass = this._hass;
    if (!hass?.connection) {
      return;
    }
    this._subs.forEach((sub, template) => {
      if (sub.unsub) {
        return;
      }
      sub.unsub = hass.connection.subscribeMessage<RenderResult>(
        (msg) => {
          const current = this._subs.get(template);
          if (current) {
            current.value = msg.result;
            this._onChange();
          }
        },
        { type: 'render_template', template },
      );
    });
  }
}
