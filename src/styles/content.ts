import { css } from 'lit';

/** Custom content area below the header, hidden while collapsed. */
export const contentStyles = css`
  .content {
    display: flex;
    flex-direction: column;
    margin-bottom: 12px;
  }

  .collapsed .content {
    display: none;
  }
`;
