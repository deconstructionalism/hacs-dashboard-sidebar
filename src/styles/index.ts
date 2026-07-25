import { baseStyles } from './base';
import { contentStyles } from './content';
import { errorStyles } from './errors';
import { footerStyles } from './footer';
import { headerStyles } from './header';
import { menuStyles } from './menu';

/**
 * The full ordered set of sidebar stylesheets, composed onto the element's
 * `static styles`. Order is layout-first (base) through footer, then the
 * error panel.
 */
export const sidebarStyles = [
  baseStyles,
  headerStyles,
  contentStyles,
  menuStyles,
  footerStyles,
  errorStyles,
];
