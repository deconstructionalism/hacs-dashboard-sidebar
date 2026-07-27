import { css } from 'lit';

/**
 * Host box, sidebar column layout, the edge collapse toggle, and the default
 * icon color. All colors resolve to Home Assistant theme variables so the
 * sidebar inherits the active light/dark theme.
 */
export const baseStyles = css`
  :host {
    display: block;
    height: 100%;
    box-sizing: border-box;
    color: var(--primary-text-color, #000);
    background: var(--card-background-color, var(--primary-background-color, #fff));
    font-family: var(--ha-font-family-body, inherit);
  }

  .sidebar {
    position: relative;
    display: flex;
    height: 100%;
    flex-direction: column;
    box-sizing: border-box;
    padding: 16px 12px;
    overflow: visible;
  }

  /* Inert single-block preview embedded in the editor: no host box, no
     interaction, sized to its content. */
  :host([preview]) {
    height: auto;
    background: transparent;
  }

  :host([preview]) .sidebar,
  :host([preview]) .sidebar.preview {
    height: auto;
    /* Keep the real horizontal inset so content sits where it will in the live
       sidebar, but no vertical padding so stacked previews stay compact. */
    padding: 0 12px;
  }

  /* Collapsed preview sits in a narrow icon-strip frame, so drop the inset. */
  :host([preview]) .sidebar.collapsed {
    padding: 0;
  }

  /* A footer-only preview pins the footer to the bottom with space above, so the
     top divider bar reads as a real separator like it does live. */
  :host([preview]) .sidebar.preview-footer {
    min-height: 140px;
    justify-content: flex-end;
  }

  /* Every element in a preview is clickable to select and draggable to reorder,
     so show a pointer and mark the selected one with an outline. */
  :host([preview]) .row,
  :host([preview]) .app-title,
  :host([preview]) .clock,
  :host([preview]) .date,
  :host([preview]) .entry-divider,
  :host([preview]) .content,
  :host([preview]) .footer-btn {
    cursor: pointer;
  }

  /* Give the divider a taller hit area so it can be selected and dragged, while
     the visible line stays 1px like live: the vertical margin becomes padding
     (same footprint) and the background paints only the 1px content strip. */
  :host([preview]) .entry-divider {
    box-sizing: content-box;
    min-height: 1px;
    margin-top: 0;
    margin-bottom: 0;
    padding-top: 6px;
    padding-bottom: 6px;
    background-clip: content-box;
  }

  :host([preview]) .sb-selected {
    outline: 2px solid var(--primary-color, #03a9f4);
    outline-offset: 1px;
    border-radius: 8px;
  }

  :host([preview]) .sortable-ghost {
    opacity: 0.4;
  }

  :host([preview]) .region-header {
    margin-bottom: 0;
  }

  :host([preview]) .region-body {
    overflow: visible;
  }

  :host([preview]) .footer {
    margin-top: 0;
  }

  .sidebar.collapsed {
    align-items: center;
    padding: 16px 6px;
  }

  .toggle {
    position: absolute;
    top: 16px;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 1px solid var(--divider-color, rgb(0 0 0 / 12%));
    border-radius: 50%;
    background: var(--card-background-color, var(--primary-background-color, #fff));
    color: var(--primary-text-color, #000);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 6;
    box-shadow: 0 1px 4px rgb(0 0 0 / 25%);
  }

  .pos-left .toggle {
    right: -13px;
  }

  .pos-right .toggle {
    left: -13px;
  }

  .toggle ha-icon {
    --mdc-icon-size: 18px;

    transition: transform 0.2s ease;
  }

  .pos-right .toggle ha-icon {
    transform: rotate(180deg);
  }

  .collapsed.pos-left .toggle ha-icon {
    transform: rotate(180deg);
  }

  .collapsed.pos-right .toggle ha-icon {
    transform: rotate(0deg);
  }

  .edit-btn {
    position: absolute;
    top: 16px;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 1px solid var(--divider-color, rgb(0 0 0 / 12%));
    border-radius: 50%;
    background: var(--card-background-color, var(--primary-background-color, #fff));
    color: var(--primary-text-color, #000);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 6;
  }

  .pos-left .edit-btn {
    left: 8px;
  }

  .pos-right .edit-btn {
    right: 8px;
  }

  .edit-btn ha-icon {
    --mdc-icon-size: 16px;
  }

  ha-icon {
    color: var(--paper-item-icon-color, var(--primary-text-color, #000));
  }

  .tooltip {
    position: fixed;
    transform: translateY(-50%);
    padding: 4px 8px;
    border-radius: 6px;
    background: var(--card-background-color, var(--primary-background-color, #fff));
    color: var(--primary-text-color, #000);
    box-shadow: 0 2px 8px rgb(0 0 0 / 30%);
    font-size: 0.85rem;
    white-space: nowrap;
    pointer-events: none;
    z-index: 10;
  }
`;
