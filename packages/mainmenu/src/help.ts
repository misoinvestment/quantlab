// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
import {
  Menu
} from '@phosphor/widgets';

import {
  IQuantLabMenu, QuantLabMenu
} from './labmenu';

/**
 * An interface for a Help menu.
 */
export
interface IHelpMenu extends IQuantLabMenu {
}

/**
 * An extensible Help menu for the application.
 */
export
class HelpMenu extends QuantLabMenu implements IHelpMenu {
  /**
   * Construct the help menu.
   */
  constructor(options: Menu.IOptions) {
    super(options);
    this.menu.title.label = 'Help';
  }
}
