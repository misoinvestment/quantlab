// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Widget, PanelLayout
} from '@phosphor/widgets';

import {
  JSONObject
} from '@phosphor/coreutils';

import {
  ICollaborator
} from '@quantlab/coreutils';

import {
  MarkdownCell
} from '@quantlab/cells';

/**
 * The class name added to the chatbox entries.
 */
export
const CHAT_ENTRY_CLASS = 'jp-ChatEntry';

/**
 * The class name added to chatbox badges.
 */
const CHAT_BADGE_CLASS = 'jp-ChatEntry-badge';

/**
 * The class name added to other user's own entries
 */
const CHAT_ENTRY_SELF_CLASS = 'jp-ChatEntry-self';

/**
 * The class name added to other user's chatbox entries
 */
const CHAT_ENTRY_RECEIVED_CLASS = 'jp-ChatEntry-receieved';


/**
 * A chat entry widget, which hosts a user badge and a markdown cell.
 */
export
class ChatEntry extends Widget {
  /**
   * Construct a chat entry widget.
   */
  constructor(options: ChatEntry.IOptions) {
    super();
    this.addClass(CHAT_ENTRY_CLASS);
    this.model = options.model;

    this.layout = new PanelLayout();

    const color = this.model.author.color;
    const r = parseInt(color.slice(1,3), 16);
    const g = parseInt(color.slice(3,5), 16);
    const b = parseInt(color.slice(5,7), 16);

    this._badge = new Widget();
    this._badge.addClass(CHAT_BADGE_CLASS);
    const badgeName = this.model.author.shortName;
    this._badge.node.textContent = badgeName;

    this.cell = options.cell;

    this._badge.node.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 1)`;

    if (!options.isMe) {
      this.cell.addClass(CHAT_ENTRY_RECEIVED_CLASS);
    } else {
      this.cell.addClass(CHAT_ENTRY_SELF_CLASS);
    }

    const layout = this.layout as PanelLayout;
    if (options.isMe) {
      layout.addWidget(this.cell);
      layout.addWidget(this._badge);
    } else {
      layout.addWidget(this._badge);
      layout.addWidget(this.cell);
    }
  }

  /**
   * Get the underlying model for the entry.
   */
  readonly model: ChatEntry.IModel;

  /**
   * The underlying cell widget for the entry.
   */
  readonly cell: MarkdownCell;

  private _badge: Widget;
}


/**
 * The namespace for `InputAreaWidget` statics.
 */
export
namespace ChatEntry {
  /**
   * Options for creating a chat entry widget.
   */
  export
  interface IOptions {
    /**
     * A chat entry model for the widget.
     */
    model: IModel;

    /**
     * A markdown widget for rendering the entry.
     */
    cell: MarkdownCell;

    /**
     * Whether this author is the local collaborator.
     */
    isMe: boolean;
  }

  /**
   * An interface for an entry in the chat log.
   */
  export
  interface IModel extends JSONObject {
    /**
     * The text of the chat entry.
     */
    text: string;

    /**
     * The collaborator who logged the entry.
     */
    author: ICollaborator;
  }
}
