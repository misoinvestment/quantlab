// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
import {
  Menu, Widget
} from '@phosphor/widgets';

import {
  IQuantLabMenu, IMenuExtender, QuantLabMenu
} from './labmenu';


/**
 * An interface for an Edit menu.
 */
export
interface IEditMenu extends IQuantLabMenu {
  /**
   * A set storing IUndoers for the Edit menu.
   */
  readonly undoers: Set<IEditMenu.IUndoer<Widget>>;

  /**
   * A set storing IClearers for the Edit menu.
   */
  readonly clearers: Set<IEditMenu.IClearer<Widget>>;

  /**
   * A set storing IClearers for the Edit menu.
   */
  readonly findReplacers: Set<IEditMenu.IFindReplacer<Widget>>;
}

/**
 * An extensible Edit menu for the application.
 */
export
class EditMenu extends QuantLabMenu implements IEditMenu {
  /**
   * Construct the edit menu.
   */
  constructor(options: Menu.IOptions) {
    super(options);
    this.menu.title.label = 'Edit';

    this.undoers =
      new Set<IEditMenu.IUndoer<Widget>>();

    this.clearers =
      new Set<IEditMenu.IClearer<Widget>>();

    this.findReplacers =
      new Set<IEditMenu.IFindReplacer<Widget>>();
  }

  /**
   * A set storing IUndoers for the Edit menu.
   */
  readonly undoers: Set<IEditMenu.IUndoer<Widget>>;

  /**
   * A set storing IClearers for the Edit menu.
   */
  readonly clearers: Set<IEditMenu.IClearer<Widget>>;

  /**
   * A set storing IClearers for the Edit menu.
   */
  readonly findReplacers: Set<IEditMenu.IFindReplacer<Widget>>;

  /**
   * Dispose of the resources held by the edit menu.
   */
  dispose(): void {
    this.undoers.clear();
    this.clearers.clear();
    this.findReplacers.clear();
    super.dispose();
  }
}

/**
 * Namespace for IEditMenu
 */
export
namespace IEditMenu {
  /**
   * Interface for an activity that uses Undo/Redo.
   */
  export
  interface IUndoer<T extends Widget> extends IMenuExtender<T> {
    /**
     * Execute an undo command for the activity.
     */
    undo?: (widget: T) => void;

    /**
     * Execute a redo command for the activity.
     */
    redo?: (widget: T) => void;
  }

  /**
   * Interface for an activity that wants to register a 'Clear...' menu item
   */
  export
  interface IClearer<T extends Widget> extends IMenuExtender<T> {
    /**
     * A label for the thing to be cleared.
     */
    noun: string;

    /**
     * A function to clear an activity.
     */
    clear: (widget: T) => void;
  }

  /**
   * Interface for an activity that uses Find/Find+Replace.
   */
  export
  interface IFindReplacer<T extends Widget> extends IMenuExtender<T> {
    /**
     * Execute a find command for the activity.
     */
    find?: (widget: T) => void;

    /**
     * Execute a find/replace command for the activity.
     */
    findAndReplace?: (widget: T) => void;
  }
}
