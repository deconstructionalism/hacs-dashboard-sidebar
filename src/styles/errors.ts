import { css } from 'lit';

/** The in-panel config-error box shown when validation fails. */
export const errorStyles = css`
  .config-error {
    margin: 12px;
    padding: 12px;
    border: 1px solid var(--error-color, #db4437);
    border-radius: 8px;
    background: color-mix(in srgb, var(--error-color, #db4437) 12%, transparent);
    color: var(--primary-text-color, #000);
    font-size: 0.85rem;
    overflow-y: auto;
  }

  .config-error-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .config-error-title ha-icon {
    color: var(--error-color, #db4437);
  }

  .config-error ul {
    margin: 0;
    padding-left: 18px;
  }

  .config-error li {
    margin: 4px 0;
  }
`;
