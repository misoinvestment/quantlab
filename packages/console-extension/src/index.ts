// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
import {
  ILayoutRestorer, QuantLab, QuantLabPlugin
} from '@quantlab/application';

import {
  Dialog, ICommandPalette, InstanceTracker, showDialog
} from '@quantlab/apputils';

import {
  IEditorServices
} from '@quantlab/codeeditor';

import {
  ConsolePanel, IConsoleTracker
} from '@quantlab/console';

import {
  PageConfig
} from '@quantlab/coreutils';

import {
  IFileBrowserFactory
} from '@quantlab/filebrowser';

import {
  ILauncher
} from '@quantlab/launcher';

import {
  IEditMenu, IFileMenu, IKernelMenu, IMainMenu, IRunMenu
} from '@quantlab/mainmenu';

import {
  find
} from '@phosphor/algorithm';

import {
  ReadonlyJSONObject
} from '@phosphor/coreutils';


/**
 * The command IDs used by the console plugin.
 */
namespace CommandIDs {
  export
  const create = 'console:create';

  export
  const clear = 'console:clear';

  export
  const runUnforced = 'console:run-unforced';

  export
  const runForced = 'console:run-forced';

  export
  const linebreak = 'console:linebreak';

  export
  const interrupt = 'console:interrupt-kernel';

  export
  const restart = 'console:restart-kernel';

  export
  const closeAndShutdown = 'console:close-and-shutdown';

  export
  const open = 'console:open';

  export
  const inject = 'console:inject';

  export
  const changeKernel = 'console:change-kernel';
}


/**
 * The console widget tracker provider.
 */
const tracker: QuantLabPlugin<IConsoleTracker> = {
  id: '@quantlab/console-extension:tracker',
  provides: IConsoleTracker,
  requires: [
    IMainMenu,
    ICommandPalette,
    ConsolePanel.IContentFactory,
    IEditorServices,
    ILayoutRestorer,
    IFileBrowserFactory
  ],
  optional: [ILauncher],
  activate: activateConsole,
  autoStart: true
};


/**
 * The console widget content factory.
 */
const factory: QuantLabPlugin<ConsolePanel.IContentFactory> = {
  id: '@quantlab/console-extension:factory',
  provides: ConsolePanel.IContentFactory,
  requires: [IEditorServices],
  autoStart: true,
  activate: (app: QuantLab, editorServices: IEditorServices) => {
    const editorFactory = editorServices.factoryService.newInlineEditor
      .bind(editorServices.factoryService);
    return new ConsolePanel.ContentFactory({ editorFactory });
  }
};


/**
 * Export the plugins as the default.
 */
const plugins: QuantLabPlugin<any>[] = [factory, tracker];
export default plugins;


/**
 * Activate the console extension.
 */
function activateConsole(app: QuantLab, mainMenu: IMainMenu, palette: ICommandPalette, contentFactory: ConsolePanel.IContentFactory,  editorServices: IEditorServices, restorer: ILayoutRestorer, browserFactory: IFileBrowserFactory, launcher: ILauncher | null): IConsoleTracker {
  const manager = app.serviceManager;
  const { commands, shell } = app;
  const category = 'Console';

  // Create an instance tracker for all console panels.
  const tracker = new InstanceTracker<ConsolePanel>({ namespace: 'console' });

  // Handle state restoration.
  restorer.restore(tracker, {
    command: CommandIDs.open,
    args: panel => ({
      path: panel.console.session.path,
      name: panel.console.session.name
    }),
    name: panel => panel.console.session.path,
    when: manager.ready
  });

  // The launcher callback.
  let callback = (cwd: string, name: string) => {
    return createConsole({ basePath: cwd, kernelPreference: { name } });
  };

  // Add a launcher item if the launcher is available.
  if (launcher) {
    manager.ready.then(() => {
      const specs = manager.specs;
      if (!specs) {
        return;
      }
      let baseUrl = PageConfig.getBaseUrl();
      for (let name in specs.kernelspecs) {
        let displayName = specs.kernelspecs[name].display_name;
        let rank = name === specs.default ? 0 : Infinity;
        let kernelIconUrl = specs.kernelspecs[name].resources['logo-64x64'];
        if (kernelIconUrl) {
          let index = kernelIconUrl.indexOf('kernelspecs');
          kernelIconUrl = baseUrl + kernelIconUrl.slice(index);
        }
        launcher.add({
          displayName,
          category: 'Console',
          name,
          iconClass: 'jp-CodeConsoleIcon',
          callback,
          rank,
          kernelIconUrl
        });
      }
    });
  }

  /**
   * Create a console for a given path.
   */
  function createConsole(options: Partial<ConsolePanel.IOptions>): Promise<ConsolePanel> {
    return manager.ready.then(() => {
      let panel = new ConsolePanel({
        manager,
        rendermime: app.rendermime.clone(),
        contentFactory,
        mimeTypeService: editorServices.mimeTypeService,
        ...options
      });

      // Add the console panel to the tracker.
      tracker.add(panel);
      shell.addToMainArea(panel);
      shell.activateById(panel.id);
      return panel;
    });
  }

  /**
   * Whether there is an active console.
   */
  function isEnabled(): boolean {
    return tracker.currentWidget !== null
           && tracker.currentWidget === app.shell.currentWidget;
  }

  let command = CommandIDs.open;
  commands.addCommand(command, {
    execute: (args: Partial<ConsolePanel.IOptions>) => {
      let path = args['path'];
      let widget = tracker.find(value => {
        return value.console.session.path === path;
      });
      if (widget) {
        shell.activateById(widget.id);
      } else {
        return manager.ready.then(() => {
          let model = find(manager.sessions.running(), item => {
            return item.path === path;
          });
          if (model) {
            return createConsole(args);
          }
          return Promise.reject(`No running console for path: ${path}`);
        });
      }
    },
  });

  command = CommandIDs.create;
  commands.addCommand(command, {
    label: 'Console',
    execute: (args: Partial<ConsolePanel.IOptions>) => {
      let basePath = args.basePath || browserFactory.defaultBrowser.model.path;
      return createConsole({ basePath, ...args });
    }
  });

  // Get the current widget and activate unless the args specify otherwise.
  function getCurrent(args: ReadonlyJSONObject): ConsolePanel | null {
    let widget = tracker.currentWidget;
    let activate = args['activate'] !== false;
    if (activate && widget) {
      shell.activateById(widget.id);
    }
    return widget;
  }

  command = CommandIDs.clear;
  commands.addCommand(command, {
    label: 'Clear Cells',
    execute: args => {
      let current = getCurrent(args);
      if (!current) {
        return;
      }
      current.console.clear();
    },
    isEnabled
  });
  palette.addItem({ command, category });

  command = CommandIDs.runUnforced;
  commands.addCommand(command, {
    label: 'Run Cell (unforced)',
    execute: args => {
      let current = getCurrent(args);
      if (!current) {
        return;
      }
      return current.console.execute();
    },
    isEnabled
  });
  palette.addItem({ command, category });

  command = CommandIDs.runForced;
  commands.addCommand(command, {
    label: 'Run Cell (forced)',
    execute: args => {
      let current = getCurrent(args);
      if (!current) {
        return;
      }
      current.console.execute(true);
    },
    isEnabled
  });
  palette.addItem({ command, category });

  command = CommandIDs.linebreak;
  commands.addCommand(command, {
    label: 'Insert Line Break',
    execute: args => {
      let current = getCurrent(args);
      if (!current) {
        return;
      }
      current.console.insertLinebreak();
    },
    isEnabled
  });
  palette.addItem({ command, category });

  command = CommandIDs.interrupt;
  commands.addCommand(command, {
    label: 'Interrupt Kernel',
    execute: args => {
      let current = getCurrent(args);
      if (!current) {
        return;
      }
      let kernel = current.console.session.kernel;
      if (kernel) {
        return kernel.interrupt();
      }
    },
    isEnabled
  });
  palette.addItem({ command, category });

  command = CommandIDs.restart;
  commands.addCommand(command, {
    label: 'Restart Kernel',
    execute: args => {
      let current = getCurrent(args);
      if (!current) {
        return;
      }
      return current.console.session.restart();
    },
    isEnabled
  });
  palette.addItem({ command, category });

  command = CommandIDs.closeAndShutdown;
  commands.addCommand(command, {
    label: 'Close and Shutdown',
    execute: args => {
      const current = getCurrent(args);
      if (!current) {
        return;
      }
      return showDialog({
        title: 'Shutdown the console?',
        body: `Are you sure you want to close "${current.title.label}"?`,
        buttons: [Dialog.cancelButton(), Dialog.warnButton()]
      }).then(result => {
        if (result.button.accept) {
          current.console.session.shutdown().then(() => {
            current.dispose();
          });
        } else {
          return false;
        }
      });
    },
    isEnabled
  });

  command = CommandIDs.inject;
  commands.addCommand(command, {
    execute: args => {
      let path = args['path'];
      tracker.find(widget => {
        if (widget.console.session.path === path) {
          if (args['activate'] !== false) {
            shell.activateById(widget.id);
          }
          widget.console.inject(args['code'] as string);
          return true;
        }
        return false;
      });
    },
    isEnabled
  });

  command = CommandIDs.changeKernel;
  commands.addCommand(command, {
    label: 'Change Kernel',
    execute: args => {
      let current = getCurrent(args);
      if (!current) {
        return;
      }
      return current.console.session.selectKernel();
    },
    isEnabled
  });
  palette.addItem({ command, category });

  // Add a console creator to the File menu
  mainMenu.fileMenu.newMenu.addItem({ command: CommandIDs.create });

  // Add a close and shutdown command to the file menu.
  mainMenu.fileMenu.closeAndCleaners.add({
    tracker,
    action: 'Shutdown',
    closeAndCleanup: (current: ConsolePanel) => {
      return showDialog({
        title: 'Shutdown the console?',
        body: `Are you sure you want to close "${current.title.label}"?`,
        buttons: [Dialog.cancelButton(), Dialog.warnButton()]
      }).then(result => {
        if (result.button.accept) {
          current.console.session.shutdown().then(() => {
            current.dispose();
          });
        } else {
          return void 0;
        }
      });
    }
  } as IFileMenu.ICloseAndCleaner<ConsolePanel>);

  // Add a kernel user to the Kernel menu
  mainMenu.kernelMenu.kernelUsers.add({
    tracker,
    interruptKernel: current => {
      let kernel = current.console.session.kernel;
      if (kernel) {
        return kernel.interrupt();
      }
      return Promise.resolve(void 0);
    },
    restartKernel: current => current.console.session.restart(),
    changeKernel: current => current.console.session.selectKernel(),
    shutdownKernel: current => current.console.session.shutdown()
  } as IKernelMenu.IKernelUser<ConsolePanel>);

  // Add a code runner to the Run menu.
  mainMenu.runMenu.codeRunners.add({
    tracker,
    noun: 'Cell',
    pluralNoun: 'Cells',
    run: current => current.console.execute(true)
  } as IRunMenu.ICodeRunner<ConsolePanel>);

  // Add a group to the edit menu.
  mainMenu.editMenu.addGroup([{ command: CommandIDs.linebreak }]);

  // Add a clearer to the edit menu
  mainMenu.editMenu.clearers.add({
    tracker,
    noun: 'Console',
    clear: (current: ConsolePanel) => { return current.console.clear() }
  } as IEditMenu.IClearer<ConsolePanel>);

  app.contextMenu.addItem({command: CommandIDs.clear, selector: '.jp-CodeConsole'});
  app.contextMenu.addItem({command: CommandIDs.restart, selector: '.jp-CodeConsole'});

  return tracker;
}
