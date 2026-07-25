// ---------------------------------------------------------------------------
//  DASHBOARD SIDEBAR
//  A collapsible dashboard sidebar for Home Assistant Lovelace.
//  https://github.com/deconstructionalism/hacs-dashboard-sidebar
// ---------------------------------------------------------------------------

import { startSidebar } from './bootstrap';
import { CARD_VERSION } from './const';
import './dashboard-sidebar';

console.info(
  `%c DASHBOARD-SIDEBAR %c v${CARD_VERSION} `,
  'color: white; background: #3f51b5; font-weight: 700;',
  'color: #3f51b5; background: white; font-weight: 700;',
);

startSidebar();
