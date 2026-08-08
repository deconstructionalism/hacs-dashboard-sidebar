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
export const applyCardMod = (
  host: HTMLElement,
  config: unknown,
  type = 'dashboard-sidebar',
): boolean => {
  const CardMod = customElements.get('card-mod') as unknown as CardModElement | undefined;
  if (typeof CardMod?.applyToElement !== 'function') {
    return false;
  }
  try {
    // The default (omitted) trailing flags make card-mod attach inside the
    // host's shadow root. `type` tags card-mod's per-element state, so a unique
    // type per element keeps their styles from colliding.
    CardMod.applyToElement(host, type, config);
    return true;
  } catch (err) {
    console.warn('[dashboard-sidebar] card-mod failed:', err);
    return false;
  }
};

/**
 * Rewrites CSS so every rule matches only the element identified by `hostSel`
 * (e.g. `[data-loc="header:0"]`) or its descendants — the basis for scoping a
 * per-element card_mod to just that element.
 *
 * Each rule's selector list `orig` becomes `hostSel:is(orig), hostSel :is(orig)`.
 * The first branch is the compound (self) match, so a bare class that names the
 * element itself — the title carries `.dashboard-sidebar-title` — matches, which
 * plain `@scope` can't do for its own root. The second branch matches descendant
 * targets (an item's icon, a category's chevron). Grouping rules (`@media`,
 * `@supports`) are recursed into; nested rules stay relative to their now-scoped
 * parent. Parsing goes through a constructed stylesheet so the browser's own CSS
 * engine handles comments, nesting, and at-rules. Returns null when the CSS
 * cannot be parsed (caller then applies it unscoped rather than dropping it).
 */
export const scopeCss = (css: string, hostSel: string): string | null => {
  let sheet: CSSStyleSheet;
  try {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
  } catch {
    return null;
  }
  const rewrite = (rules: CSSRuleList): void => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        const orig = rule.selectorText;
        // Scope this rule; leave any nested rules relative to the scoped parent.
        rule.selectorText = `${hostSel}:is(${orig}), ${hostSel} :is(${orig})`;
      } else {
        const grouping = rule as CSSRule & { cssRules?: CSSRuleList };
        if (grouping.cssRules) {
          rewrite(grouping.cssRules);
        }
      }
    }
  };
  rewrite(sheet.cssRules);
  return Array.from(sheet.cssRules)
    .map((r) => r.cssText)
    .join('\n');
};
