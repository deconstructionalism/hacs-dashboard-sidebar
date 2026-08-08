import { html, type TemplateResult } from 'lit';

/** One selectable row in a popup menu. */
export interface MenuItem {
  /** The row label. */
  label: string;
  /** Run when the row is clicked. */
  run: () => void;
}

/**
 * Fixed-position style for a menu anchored to a trigger rect: drops below the
 * trigger, or flips above it when there is more room up, and caps its height to
 * the available space (the menu scrolls internally past that). `align` pins the
 * menu's left or right edge to the trigger.
 */
export const menuStyle = (rect: DOMRect, align: 'left' | 'right'): string => {
  const margin = 8;
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const below = spaceBelow >= spaceAbove;
  const maxHeight = Math.max(120, (below ? spaceBelow : spaceAbove) - margin - 4);
  const vertical = below
    ? `top: ${rect.bottom + 4}px`
    : `bottom: ${window.innerHeight - rect.top + 4}px`;
  const horizontal =
    align === 'right'
      ? `right: ${Math.max(margin, window.innerWidth - rect.right)}px`
      : `left: ${Math.max(margin, rect.left)}px`;
  return `${vertical}; ${horizontal}; max-height: ${maxHeight}px`;
};

/**
 * A simple popup menu: a click-away scrim plus a fixed-positioned list of
 * buttons. Each item runs its action and then closes the menu.
 */
export const popupMenu = (
  rect: DOMRect,
  items: MenuItem[],
  onClose: () => void,
): TemplateResult => html`
  <div class="menu-scrim" @click=${onClose}></div>
  <div class="add-menu" style=${menuStyle(rect, 'left')}>
    ${items.map(
      (item) =>
        html`<button
          class="add-menu-item"
          @click=${() => {
            item.run();
            onClose();
          }}
        >
          ${item.label}
        </button>`,
    )}
  </div>
`;
