import type { HomeAssistant } from 'custom-card-helpers';

import type { ItemBlock, SidebarBlock, DashboardSidebarConfig } from './types';

/** Matches the opening delimiter of any Jinja construct. */
const TEMPLATE_RE = /\{\{|\{%|\{#/;

/**
 * Returns true when a string carries a Jinja template and therefore needs
 * server-side rendering rather than literal use.
 */
export function isTemplate(value: string | undefined): value is string {
  return typeof value === 'string' && TEMPLATE_RE.test(value);
}

/** Shape of a `render_template` websocket message payload. */
interface RenderResult {
  /** The rendered template output. */
  result: string;
}

/** Cached state for one subscribed template string. */
interface Subscription {
  /** Latest rendered value, empty until the first message arrives. */
  value: string;
  /** Promise resolving to the unsubscribe function, once subscribed. */
  unsub?: Promise<() => void>;
}

/**
 * Subscribes to Home Assistant's `render_template` websocket for each unique
 * template string in the config and caches the latest result. Literal strings
 * are returned as-is and never subscribed. Card blocks are skipped; the cards
 * they render handle their own templating.
 */
export class TemplateManager {
  /** The current Home Assistant object, or undefined before first assignment. */
  private _hass?: HomeAssistant;

  /** Cached subscriptions keyed by the raw template string. */
  private readonly _subs = new Map<string, Subscription>();

  /** Callback invoked whenever a subscribed template produces a new value. */
  private readonly _onChange: () => void;

  /**
   * Stores the change callback fired when any template result updates.
   */
  constructor(onChange: () => void) {
    this._onChange = onChange;
  }

  /**
   * Updates the Home Assistant object and, on the first connected hass, flushes
   * any templates collected before the connection was available.
   */
  public setHass(hass: HomeAssistant | undefined): void {
    const first = !this._hass;
    this._hass = hass;
    if (first && hass?.connection) {
      this._flush();
    }
  }

  /**
   * Registers every templatable string across the header, body, and footer for
   * subscription, clearing any previously collected templates first.
   */
  public collect(config: DashboardSidebarConfig): void {
    this.clear();
    /**
     * Registers one candidate string if it is a not-yet-seen template.
     */
    const add = (value: string | undefined): void => {
      if (isTemplate(value) && !this._subs.has(value)) {
        this._subs.set(value, { value: '' });
      }
    };
    /**
     * Registers every templatable field on one item.
     */
    const addItem = (item: ItemBlock): void => {
      add(item.title);
      add(item.icon);
      add(item.text_color);
      add(item.icon_color);
    };
    /**
     * Registers the templatable fields of one header/body block.
     */
    const addBlock = (block: SidebarBlock): void => {
      switch (block.type) {
        case 'title':
          add(block.text);
          add(block.text_color);
          break;
        case 'clock':
        case 'date':
          add(block.text_color);
          break;
        case 'divider':
          add(block.color);
          break;
        case 'markdown':
          add(block.text_color);
          break;
        case 'item':
          addItem(block);
          break;
        case 'category':
          add(block.title);
          add(block.icon);
          add(block.text_color);
          add(block.icon_color);
          block.items.forEach(addItem);
          break;
        default:
          break;
      }
    };
    (config.header ?? []).forEach(addBlock);
    (config.body ?? []).forEach(addBlock);
    (config.footer?.buttons ?? []).forEach((btn) => {
      add(btn.icon);
      add(btn.icon_color);
      add(btn.title);
    });
    add(config.footer?.markdown_color);
    this._flush();
  }

  /**
   * Resolves a value to its literal, or to the cached template result, which is
   * empty until the first render message arrives.
   */
  public resolve(value: string | undefined): string {
    if (value === undefined) {
      return '';
    }
    if (!isTemplate(value)) {
      return value;
    }
    return this._subs.get(value)?.value ?? '';
  }

  /**
   * Unsubscribes from every active template and drops the cache.
   */
  public clear(): void {
    this._subs.forEach((sub) => {
      sub.unsub?.then((unsub) => unsub()).catch(() => undefined);
    });
    this._subs.clear();
  }

  /**
   * Opens a websocket subscription for each collected template that is not yet
   * subscribed, updating the cache and notifying on each result.
   */
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
