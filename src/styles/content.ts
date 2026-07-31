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

  /* The footer's single card/markdown fills the footer bar width (the bar is a
     flex row, which would otherwise size it to its content) and drops the
     block spacing below it (the footer is already pinned to the bottom). */
  .footer .content {
    width: 100%;
    margin-bottom: 0;
  }

  .collapsed .content {
    display: none;
  }
`;
