import { css } from 'lit';

/**
 * Text blocks: title, clock, and date. Their horizontal padding matches the
 * menu rows so left-aligned text lines up with the item icons.
 */
export const headerStyles = css`
  .app-title {
    font-size: 1.25rem;
    font-weight: 500;
    padding: 2px 12px;
  }

  .clock {
    font-size: 1.5rem;
    font-weight: 300;
    font-variant-numeric: tabular-nums;
    padding: 0 12px;
  }

  .collapsed .clock {
    font-size: 0.85rem;
    padding: 0;
  }

  .date {
    font-size: 0.9rem;
    opacity: 0.75;
    font-variant-numeric: tabular-nums;
    padding: 0 12px;
  }

  .collapsed .date {
    font-size: 0.7rem;
    padding: 0;
  }
`;
