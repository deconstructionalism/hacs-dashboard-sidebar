import { css } from 'lit';

/**
 * Edit-mode chrome: the per-element control clusters (drag handle, edit,
 * delete), the add controls, and the non-interactive block display.
 */
export const editStyles = css`
  .edit-block {
    display: flex;
    align-items: center;
    gap: 6px;
    border-radius: 10px;
    margin: 2px 0;
  }

  .edit-block:hover {
    background: var(--divider-color, rgb(0 0 0 / 6%));
  }

  .edit-block .edit-body {
    flex: 1;
    min-width: 0;
    pointer-events: none;
  }

  .edit-category {
    display: block;
  }

  .edit-category .edit-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .edit-cat-items {
    padding-left: 16px;
    border-left: 1px solid var(--divider-color, rgb(0 0 0 / 12%));
    margin: 2px 0 2px 12px;
  }

  .edit-footer-btn .edit-body {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .edit-footer-btn .rsum,
  .edit-block .rsum {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .edit-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 0 0 auto;
  }

  .edit-handle {
    cursor: grab;
    opacity: 0.5;
    display: flex;
  }

  .edit-handle ha-icon,
  .edit-ctl ha-icon {
    --mdc-icon-size: 18px;
  }

  .edit-ctl {
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: 2px;
    border-radius: 6px;
    display: flex;
  }

  .edit-ctl:hover {
    background: var(--divider-color, rgb(0 0 0 / 12%));
  }

  .edit-del:hover {
    color: var(--error-color, #db4437);
  }

  .edit-add {
    font: inherit;
    width: 100%;
    margin-top: 4px;
    padding: 6px 8px;
    border: 1px dashed var(--divider-color, rgb(0 0 0 / 25%));
    border-radius: 8px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .edit-add-btn {
    font: inherit;
    margin-top: 4px;
    padding: 4px 10px;
    border: 1px dashed var(--divider-color, rgb(0 0 0 / 25%));
    border-radius: 8px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .edit-footer-modes {
    display: flex;
    gap: 4px;
    width: 100%;
  }

  .edit-footer-modes .edit-add-btn {
    flex: 1;
    text-align: center;
    border-style: solid;
  }

  .edit-footer-modes .edit-add-btn.sel {
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
    border-color: transparent;
  }

  .edit-footer {
    flex-direction: column;
    align-items: stretch;
  }
`;
