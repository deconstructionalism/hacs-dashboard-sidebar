import { baseStyles } from './base';
import { contentStyles } from './content';
import { errorStyles } from './errors';
import { footerStyles } from './footer';
import { headerStyles } from './header';
import { menuStyles } from './menu';
import { regionStyles } from './regions';

/**
 * The full ordered set of sidebar stylesheets, composed onto the element's
 * `static styles`. Order is layout-first (base, regions) through footer, then
 * the error panel.
 */
export const sidebarStyles = [
  baseStyles,
  regionStyles,
  headerStyles,
  contentStyles,
  menuStyles,
  footerStyles,
  errorStyles,
];
