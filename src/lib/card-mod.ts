/**
 * The static apply surface of the card-mod integration's custom element.
 * card-mod is not a card, so it has no `setConfig`; this method is how a
 * custom card asks card-mod to style an element it owns.
 */
interface CardModElement {
  /**
   * Renders `config` (a `{ style, class }` object) into `element`'s shadow
   * root and keeps it live against hass. The `type` tags card-mod's internal
   * per-element state so repeat calls reuse one instance.
   */
  applyToElement?: (element: HTMLElement, type: string, config: unknown) => void;
}

/**
 * Delegates styling to the card-mod integration when it is installed, rendering
 * the given `card_mod` config into the host's shadow root. Returns true when
 * card-mod handled it, false when card-mod is absent or threw. Any failure is
 * swallowed so card-mod can never break the sidebar itself.
 */
export function applyCardMod(host: HTMLElement, config: unknown): boolean {
  const CardMod = customElements.get('card-mod') as unknown as CardModElement | undefined;
  if (typeof CardMod?.applyToElement !== 'function') {
    return false;
  }
  try {
    // The default (omitted) third-position flags make card-mod attach inside
    // host.shadowRoot, where the dashboard-sidebar-* classes live.
    CardMod.applyToElement(host, 'dashboard-sidebar', config);
    return true;
  } catch (err) {
    console.warn('[dashboard-sidebar] card-mod failed:', err);
    return false;
  }
}
