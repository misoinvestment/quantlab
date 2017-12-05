// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
import {
  ILayoutRestorer, QuantLab, QuantLabPlugin
} from '@quantlab/application';

import {
  ICommandPalette, InstanceTracker
} from '@quantlab/apputils';

import {
  ILauncher
} from '@quantlab/launcher';

import {
  IMainMenu
} from '@quantlab/mainmenu';

import {
  ServiceManager
} from '@quantlab/services';

import {
  Terminal, ITerminalTracker
} from '@quantlab/terminal';


/**
 * The command IDs used by the terminal plugin.
 */
namespace CommandIDs {
  export
  const createNew = 'terminal:create-new';

  export
  const open = 'terminal:open';

  export
  const refresh = 'terminal:refresh';

  export
  const increaseFont = 'terminal:increase-font';

  export
  const decreaseFont = 'terminal:decrease-font';

  export
  const toggleTheme = 'terminal:toggle-theme';
}


/**
 * The class name for the terminal icon in the default theme.
 */
const TERMINAL_ICON_CLASS = 'jp-TerminalIcon';


/**
 * The default terminal extension.
 */
const plugin: QuantLabPlugin<ITerminalTracker> = {
  activate,
  id: '@quantlab/terminal-extension:plugin',
  provides: ITerminalTracker,
  requires: [
    IMainMenu, ICommandPalette, ILayoutRestorer
  ],
  optional: [ILauncher],
  autoStart: true
};


/**
 * Export the plugin as default.
 */
export default plugin;


/**
 * Activate the terminal plugin.
 */
function activate(app: QuantLab, mainMenu: IMainMenu, palette: ICommandPalette, restorer: ILayoutRestorer, launcher: ILauncher | null): ITerminalTracker {
  const { commands, serviceManager } = app;
  const category = 'Terminal';
  const namespace = 'terminal';
  const tracker = new InstanceTracker<Terminal>({ namespace });

  // Bail if there are no terminals available.
  if (!serviceManager.terminals.isAvailable()) {
    console.log('Disabling terminals plugin because they are not available on the server');
    return tracker;
  }

  // Handle state restoration.
  restorer.restore(tracker, {
    command: CommandIDs.createNew,
    args: widget => ({ name: widget.session.name }),
    name: widget => widget.session && widget.session.name
  });

  addCommands(app, serviceManager, tracker);

  // Add some commands to the application view menu.
  const viewGroup = [
    CommandIDs.refresh,
    CommandIDs.increaseFont,
    CommandIDs.decreaseFont,
    CommandIDs.toggleTheme
  ].map(command => { return { command }; });
  mainMenu.viewMenu.addGroup(viewGroup, 30);

  // Add command palette items.
  [
    CommandIDs.refresh,
    CommandIDs.increaseFont,
    CommandIDs.decreaseFont,
    CommandIDs.toggleTheme
  ].forEach(command => {
    palette.addItem({ command, category });
  });

  // Add terminal creation to the file menu.
  mainMenu.fileMenu.newMenu.addItem({ command: CommandIDs.createNew });

  // Add a launcher item if the launcher is available.
  if (launcher) {
    launcher.add({
      displayName: 'Terminal',
      category: 'Other',
      rank: 0,
      iconClass: TERMINAL_ICON_CLASS,
      callback: () => {
        return commands.execute(CommandIDs.createNew);
      }
    });
  }

  app.contextMenu.addItem({command: CommandIDs.refresh, selector: '.jp-Terminal', rank: 1});

  return tracker;
}


/**
 * Add the commands for the terminal.
 */
export
function addCommands(app: QuantLab, services: ServiceManager, tracker: InstanceTracker<Terminal>) {
  let { commands, shell } = app;

  /**
   * Whether there is an active terminal.
   */
  function isEnabled(): boolean {
    return tracker.currentWidget !== null &&
           tracker.currentWidget === app.shell.currentWidget;
  }

  // Add terminal commands.
  commands.addCommand(CommandIDs.createNew, {
    label: 'Terminal',
    caption: 'Start a new terminal session',
    execute: args => {
      let name = args['name'] as string;
      let initialCommand = args['initialCommand'] as string;
      let term = new Terminal({ initialCommand });
      term.title.closable = true;
      term.title.icon = TERMINAL_ICON_CLASS;
      term.title.label = '...';
      shell.addToMainArea(term);

      let promise = name ?
        services.terminals.connectTo(name)
        : services.terminals.startNew();

      return promise.then(session => {
        term.session = session;
        tracker.add(term);
        shell.activateById(term.id);
        return term;
      }).catch(() => { term.dispose(); });
    }
  });

  commands.addCommand(CommandIDs.open, {
    execute: args => {
      const name = args['name'] as string;
      // Check for a running terminal with the given name.
      const widget = tracker.find(value => {
        return value.session && value.session.name === name || false;
      });
      if (widget) {
        shell.activateById(widget.id);
      } else {
        // Otherwise, create a new terminal with a given name.
        return commands.execute(CommandIDs.createNew, { name });
      }
    }
  });

  commands.addCommand(CommandIDs.refresh, {
    label: 'Refresh Terminal',
    caption: 'Refresh the current terminal session',
    execute: () => {
      let current = tracker.currentWidget;
      if (!current) {
        return;
      }
      shell.activateById(current.id);

      return current.refresh().then(() => {
        if (current) {
          current.activate();
        }
      });
    },
    isEnabled: () => tracker.currentWidget !== null
  });

  commands.addCommand('terminal:increase-font', {
    label: 'Increase Terminal Font Size',
    execute: () => {
      let options = Terminal.defaultOptions;
      if (options.fontSize < 72) {
        options.fontSize++;
        tracker.forEach(widget => { widget.fontSize = options.fontSize; });
      }
    },
    isEnabled
  });

  commands.addCommand('terminal:decrease-font', {
    label: 'Decrease Terminal Font Size',
    execute: () => {
      let options = Terminal.defaultOptions;
      if (options.fontSize > 9) {
        options.fontSize--;
        tracker.forEach(widget => { widget.fontSize = options.fontSize; });
      }
    },
    isEnabled
  });

  let terminalTheme: Terminal.Theme = 'dark';
  commands.addCommand('terminal:toggle-theme', {
    label: 'Use Dark Terminal Theme',
    caption: 'Whether to use the dark terminal theme',
    isToggled: () => terminalTheme === 'dark',
    execute: () => {
      terminalTheme = terminalTheme === 'dark' ? 'light' : 'dark';
      tracker.forEach(widget => {
        if (widget.theme !== terminalTheme) {
          widget.theme = terminalTheme;
        }
      });
    },
    isEnabled
  });
}
