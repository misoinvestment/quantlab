// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ILayoutRestorer, QuantLab, QuantLabPlugin
} from '@quantlab/application';

import {
  ICommandPalette, IMainMenu, InstanceTracker, ToolbarButton
} from '@quantlab/apputils';

import {
  IStateDB
} from '@quantlab/coreutils';

import {
  IDocumentManager
} from '@quantlab/docmanager';

import {
  DocumentRegistry
} from '@quantlab/docregistry';

import {
  FileBrowserModel, FileBrowser, IFileBrowserFactory
} from '@quantlab/filebrowser';

import {
  Launcher
} from '@quantlab/launcher';

import {
  each
} from '@phosphor/algorithm';

import {
  CommandRegistry
} from '@phosphor/commands';

import {
  Menu
} from '@phosphor/widgets';


/**
 * The command IDs used by the file browser plugin.
 */
namespace CommandIDs {
  export
  const copy = 'filebrowser:copy';

  export
  const cut = 'filebrowser:cut';

  export
  const del = 'filebrowser:delete';

  export
  const download = 'filebrowser:download';

  export
  const duplicate = 'filebrowser:duplicate';

  export
  const hideBrowser = 'filebrowser:hide-main'; // For main browser only.

  export
  const open = 'filebrowser:open';

  export
  const paste = 'filebrowser:paste';

  export
  const rename = 'filebrowser:rename';

  export
  const showBrowser = 'filebrowser:activate-main'; // For main browser only.

  export
  const shutdown = 'filebrowser:shutdown';

  export
  const toggleBrowser = 'filebrowser:toggle-main'; // For main browser only.

  export
  const createLauncher = 'filebrowser:create-main-launcher'; // For main browser only.
};


/**
 * The default file browser extension.
 */
const fileBrowserPlugin: QuantLabPlugin<void> = {
  activate: activateFileBrowser,
  id: 'jupyter.extensions.filebrowser',
  requires: [
    IFileBrowserFactory,
    IDocumentManager,
    ICommandPalette,
    ILayoutRestorer
  ],
  autoStart: true
};

/**
 * The default file browser factory provider.
 */
const factoryPlugin: QuantLabPlugin<IFileBrowserFactory> = {
  activate: activateFactory,
  id: 'jupyter.services.filebrowser',
  provides: IFileBrowserFactory,
  requires: [IDocumentManager, IStateDB],
  autoStart: true
};

/**
 * The default file browser menu extension.
 */
const fileBrowserMenuPlugin: QuantLabPlugin<void> = {
  activate: activateFileBrowserMenu,
  id: 'jupyter.extensions.filebrowsermenu',
  requires: [
    IMainMenu,
  ],
  autoStart: true
};

/**
 * The file browser namespace token.
 */
const namespace = 'filebrowser';


/**
 * Export the plugins as default.
 */
const plugins: QuantLabPlugin<any>[] = [factoryPlugin, fileBrowserPlugin, fileBrowserMenuPlugin];
export default plugins;


/**
 * Activate the file browser factory provider.
 */
function activateFactory(app: QuantLab, docManager: IDocumentManager, state: IStateDB): IFileBrowserFactory {
  const { commands } = app;
  const tracker = new InstanceTracker<FileBrowser>({ namespace });

  const createFileBrowser = (id: string, options: IFileBrowserFactory.IOptions = {}) => {
    const model = new FileBrowserModel({
      manager: docManager,
      driveName: options.driveName || '',
      state: options.state === null ? null : options.state || state
    });
    const widget = new FileBrowser({
      id, model, commands: options.commands || commands
    });
    const { registry } = docManager;

    // Add a launcher toolbar item.
    let launcher = new ToolbarButton({
      className: 'jp-AddIcon',
      onClick: () => {
        return createLauncher(commands, widget);
      }
    });
    launcher.addClass('jp-MaterialIcon');
    widget.toolbar.insertItem(0, 'launch', launcher);

    // Add a context menu handler to the file browser's directory listing.
    let node = widget.node.getElementsByClassName('jp-DirListing-content')[0];
    node.addEventListener('contextmenu', (event: MouseEvent) => {
      event.preventDefault();
      const path = widget.pathForClick(event) || '';
      const menu = createContextMenu(path, commands, registry);
      menu.open(event.clientX, event.clientY);
    });

    // Track the newly created file browser.
    tracker.add(widget);

    return widget;
  };
  let defaultBrowser = createFileBrowser('filebrowser');
  return { createFileBrowser, defaultBrowser, tracker };
}

/**
 * Activate the default file browser in the sidebar.
 */
function activateFileBrowser(app: QuantLab, factory: IFileBrowserFactory, docManager: IDocumentManager, palette: ICommandPalette, restorer: ILayoutRestorer): void {
  const fbWidget = factory.defaultBrowser;

  // Let the application restorer track the primary file browser (that is
  // automatically created) for restoration of application state (e.g. setting
  // the file browser as the current side bar widget).
  //
  // All other file browsers created by using the factory function are
  // responsible for their own restoration behavior, if any.
  restorer.add(fbWidget, namespace);

  addCommands(app, factory.tracker, fbWidget);

  fbWidget.title.label = 'Files';
  app.shell.addToLeftArea(fbWidget, { rank: 100 });

  // If the layout is a fresh session without saved data, open file browser.
  app.restored.then(layout => {
    if (layout.fresh) {
      app.commands.execute(CommandIDs.showBrowser, void 0);
    }
  });

  // Create a launcher if there are no open items.
  app.shell.layoutModified.connect(() => {
    if (app.shell.isEmpty('main')) {
      // Make sure the model is restored.
      fbWidget.model.restored.then(() => {
        createLauncher(app.commands, fbWidget);
      });
    }
  });
}


/**
 * Activate the default file browser menu in the main menu.
 */
function activateFileBrowserMenu(app: QuantLab, mainMenu: IMainMenu): void {
  let menu = createMenu(app);

  mainMenu.addMenu(menu, { rank: 1 });
}


/**
 * Add the main file browser commands to the application's command registry.
 */
function addCommands(app: QuantLab, tracker: InstanceTracker<FileBrowser>, mainBrowser: FileBrowser): void {
  const { commands } = app;

  commands.addCommand(CommandIDs.del, {
    execute: () => {
      const widget = tracker.currentWidget;
      if (!widget) {
        return;
      }

      return widget.delete();
    },
    iconClass: 'jp-MaterialIcon jp-CloseIcon',
    label: 'Delete',
    mnemonic: 0
  });

  commands.addCommand(CommandIDs.copy, {
    execute: () => {
      const widget = tracker.currentWidget;
      if (!widget) {
        return;
      }

      return widget.copy();
    },
    iconClass: 'jp-MaterialIcon jp-CopyIcon',
    label: 'Copy',
    mnemonic: 0
  });

  commands.addCommand(CommandIDs.cut, {
    execute: () => {
      const widget = tracker.currentWidget;
      if (!widget) {
        return;
      }

      return widget.cut();
    },
    iconClass: 'jp-MaterialIcon jp-CutIcon',
    label: 'Cut'
  });

  commands.addCommand(CommandIDs.download, {
    execute: () => {
      const widget = tracker.currentWidget;
      if (!widget) {
        return;
      }

      return widget.download();
    },
    iconClass: 'jp-MaterialIcon jp-DownloadIcon',
    label: 'Download'
  });

  commands.addCommand(CommandIDs.duplicate, {
    execute: () => {
      const widget = tracker.currentWidget;
      if (!widget) {
        return;
      }

      return widget.duplicate();
    },
    iconClass: 'jp-MaterialIcon jp-CopyIcon',
    label: 'Duplicate'
  });

  commands.addCommand(CommandIDs.hideBrowser, {
    execute: () => {
      if (!mainBrowser.isHidden) {
        app.shell.collapseLeft();
      }
    }
  });

  commands.addCommand(CommandIDs.open, {
    execute: () => {
      const widget = tracker.currentWidget;
      if (!widget) {
        return;
      }

      each(widget.selectedItems(), item => {
        if (item.type === 'directory') {
          widget.model.cd(item.path);
        } else {
          commands.execute('docmanager:open', { path: item.path });
        }
      });
    },
    iconClass: 'jp-MaterialIcon jp-OpenFolderIcon',
    label: 'Open',
    mnemonic: 0,
  });

  commands.addCommand(CommandIDs.paste, {
    execute: () => {
      const widget = tracker.currentWidget;
      if (!widget) {
        return;
      }

      return widget.paste();
    },
    iconClass: 'jp-MaterialIcon jp-PasteIcon',
    label: 'Paste',
    mnemonic: 0
  });

  commands.addCommand(CommandIDs.rename, {
    execute: (args) => {
      const widget = tracker.currentWidget;
      if (!widget) {
        return;
      }
      return widget.rename();
    },
    iconClass: 'jp-MaterialIcon jp-EditIcon',
    label: 'Rename',
    mnemonic: 0
  });

  commands.addCommand(CommandIDs.showBrowser, {
    execute: () => { app.shell.activateById(mainBrowser.id); }
  });

  commands.addCommand(CommandIDs.shutdown, {
    execute: () => {
      const widget = tracker.currentWidget;
      if (!widget) {
        return;
      }

      return widget.shutdownKernels();
    },
    iconClass: 'jp-MaterialIcon jp-StopIcon',
    label: 'Shutdown Kernel'
  });

  commands.addCommand(CommandIDs.toggleBrowser, {
    execute: () => {
      if (mainBrowser.isHidden) {
        return commands.execute(CommandIDs.showBrowser, void 0);
      } else {
        return commands.execute(CommandIDs.hideBrowser, void 0);
      }
    }
  });

  commands.addCommand(CommandIDs.createLauncher, {
    label: 'New...',
    execute: () => {
      return createLauncher(commands, mainBrowser);
    }
  });
}


/**
 * Create a top level menu for the file browser.
 */
function createMenu(app: QuantLab): Menu {
  const { commands } = app;
  const menu = new Menu({ commands });

  menu.title.label = 'File';
  [
    CommandIDs.createLauncher,
    'docmanager:save',
    'docmanager:save-as',
    'docmanager:rename',
    'docmanager:restore-checkpoint',
    'docmanager:clone',
    'docmanager:close',
    'docmanager:close-all-files'
  ].forEach(command => { menu.addItem({ command }); });
  menu.addItem({ type: 'separator' });
  menu.addItem({ command: 'settingeditor:open' });

  return menu;
}


/**
 * Create a context menu for the file browser listing.
 *
 * #### Notes
 * This function generates temporary commands with an incremented name. These
 * commands are disposed when the menu itself is disposed.
 */
function createContextMenu(path: string, commands: CommandRegistry, registry: DocumentRegistry):  Menu {
  const menu = new Menu({ commands });

  menu.addItem({ command: CommandIDs.open });

  const factories = registry.preferredWidgetFactories(path).map(f => f.name);
  if (path && factories.length > 1) {
    const command =  'docmanager:open';
    const openWith = new Menu({ commands });
    openWith.title.label = 'Open With...';
    factories.forEach(factory => {
      openWith.addItem({ args: { factory, path }, command });
    });
    menu.addItem({ type: 'submenu', submenu: openWith });
  }

  menu.addItem({ command: CommandIDs.rename });
  menu.addItem({ command: CommandIDs.del });
  menu.addItem({ command: CommandIDs.duplicate });
  menu.addItem({ command: CommandIDs.cut });
  menu.addItem({ command: CommandIDs.copy });
  menu.addItem({ command: CommandIDs.paste });
  menu.addItem({ command: CommandIDs.download });
  menu.addItem({ command: CommandIDs.shutdown });

  return menu;
}


/**
 * Create a launcher for a given filebrowser widget.
 */
function createLauncher(commands: CommandRegistry, widget: FileBrowser): Promise<void> {
  return commands.execute('launcher:create', {
    cwd: widget.model.path
  }).then((launcher: Launcher) => {
    widget.model.pathChanged.connect(() => {
      launcher.cwd = widget.model.path;
    }, launcher);
  });
}
