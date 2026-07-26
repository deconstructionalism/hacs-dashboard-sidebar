import { css } from 'lit';

/**
 * Menu blocks: item rows, collapsed icon rows, categories with their guide
 * line and chevron, the fixed-position popover, and the entry divider.
 */
export const menuStyles = css`
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .row:hover {
    background: var(--divider-color, rgb(0 0 0 / 8%));
  }

  .row .label {
    flex: 1;
    font-size: 1rem;
  }

  .collapsed-row {
    width: 44px;
    height: 44px;
    justify-content: center;
    padding: 0;
    gap: 0;
  }

  .collapsed-row.active {
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
  }

  .initials {
    font-size: 0.85rem;
    font-weight: 600;
  }

  .category {
    margin: 4px 0;
  }

  .category-header {
    font-weight: 600;
    opacity: 0.85;
  }

  .chevron {
    --mdc-icon-size: 20px;

    flex: 0 0 auto;
    opacity: 0.7;
    transition: transform 0.2s ease;
  }

  .chevron:not(.open) {
    transform: rotate(-90deg);
  }

  .category-items {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-left: 8px;
    border-left: 1px solid var(--divider-color, rgb(0 0 0 / 12%));
    margin-left: 18px;
  }

  .category-items.no-line {
    border-left: none;
  }

  .category-anchor {
    position: relative;
  }

  .popover {
    position: fixed;
    min-width: 180px;
    padding: 8px;
    border-radius: 12px;
    background: var(--card-background-color, var(--primary-background-color, #fff));
    box-shadow: 0 4px 16px rgb(0 0 0 / 30%);
    z-index: 9;
  }

  .popover-title {
    font-weight: 600;
    padding: 4px 12px 8px;
  }

  .entry-divider {
    flex: none;
    align-self: stretch;
    height: 1px;
    min-height: 1px;
    margin: 6px 4px;
    background: var(--divider-color, rgb(0 0 0 / 12%));
  }

  .collapsed .entry-divider {
    width: 60%;
    margin: 6px auto;
  }
`;
