import { css } from 'lit';

/**
 * The two block regions: a fixed header pinned to the top and a body that
 * takes the remaining height and scrolls independently.
 */
export const regionStyles = css`
  .region {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    box-sizing: border-box;
  }

  .region-header {
    flex: 0 0 auto;
    margin-bottom: 8px;
  }

  .region-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }

  .collapsed .region {
    align-items: center;
  }
`;
