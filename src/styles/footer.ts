import { css } from 'lit';

/** Bottom footer bar: its divider, the icon buttons, and the overflow popover. */
export const footerStyles = css`
  .footer {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--divider-color, rgb(0 0 0 / 12%));
  }

  .collapsed .footer {
    justify-content: center;
  }

  .footer.no-divider {
    border-top: none;
    padding-top: 0;
  }

  .footer-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .footer-btn:hover,
  .footer-btn.active {
    background: var(--divider-color, rgb(0 0 0 / 8%));
  }

  .footer-popover {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    min-width: 0;
    width: max-content;
    max-width: 220px;
  }
`;
