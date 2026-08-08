import { html, type TemplateResult } from 'lit';

/**
 * Faded skeleton rows standing in for the content beside a pinned region:
 * fading up (toward the top) above a footer, or down (toward the bottom) below a
 * header.
 */
export const renderGhost = (fade: 'up' | 'down'): TemplateResult => {
  const widths = [72, 54, 84, 48, 66, 60, 78, 50];
  return html`
    <div class="pv-ghost fade-${fade}">
      ${widths.map(
        (w) =>
          html`<div class="ghost-row">
            <span class="ghost-icon"></span><span class="ghost-bar" style="width: ${w}%"></span>
          </div>`,
      )}
    </div>
  `;
};

/**
 * The borderless empty state for a region with no elements: a short prompt and
 * the given add control.
 */
export const renderEmptyState = (add: TemplateResult): TemplateResult => html`
  <div class="empty-state">
    <p class="empty-msg">Add your first element for this area to show up.</p>
    ${add}
  </div>
`;
