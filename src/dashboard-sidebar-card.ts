// ---------------------------------------------------------------------------
//  DASHBOARD SIDEBAR
//  A collapsible dashboard sidebar for Home Assistant Lovelace.
//  https://github.com/deconstructionalism/homeassistant-dashboard-sidebar
// ---------------------------------------------------------------------------

import './dashboard-sidebar';
import './editor/sidebar-editor';
import { startSidebar } from './lib/bootstrap';
import { CARD_VERSION } from './lib/const';

console.info(
  `%c DASHBOARD-SIDEBAR %c v${CARD_VERSION} `,
  'color: white; background: #3f51b5; font-weight: 700;',
  'color: #3f51b5; background: white; font-weight: 700;',
);

startSidebar();
