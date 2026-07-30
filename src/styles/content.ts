import { css } from 'lit';

/** Custom content area below the header, hidden while collapsed. */
export const contentStyles = css`
  .content {
    display: flex;
    flex-direction: column;
    margin-bottom: 12px;
  }

  /* An object manual card fills the sidebar width. Force the card element to
     full width so it does not shrink to its intrinsic content size. */
  .content.card-fill > * {
    width: 100%;
    box-sizing: border-box;
  }

  .collapsed .content {
    display: none;
  }
`;
