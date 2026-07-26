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
