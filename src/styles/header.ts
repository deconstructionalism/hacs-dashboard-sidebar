import { css } from 'lit';

/** Header block: title, digital clock, and date, expanded and collapsed. */
export const headerStyles = css`
  .header {
    margin-bottom: 16px;
    text-align: center;
  }

  .app-title {
    font-size: 1.25rem;
    font-weight: 500;
    margin-bottom: 8px;
  }

  .clock {
    font-size: 1.5rem;
    font-weight: 300;
    font-variant-numeric: tabular-nums;
  }

  .collapsed .clock {
    font-size: 0.85rem;
  }

  .date {
    font-size: 0.9rem;
    opacity: 0.75;
    font-variant-numeric: tabular-nums;
  }

  .collapsed .date {
    font-size: 0.7rem;
  }
`;
