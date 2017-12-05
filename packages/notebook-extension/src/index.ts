// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
import {
  ILayoutRestorer, QuantLab, QuantLabPlugin
} from '@quantlab/application';

import {
  Dialog, ICommandPalette, showDialog
} from '@quantlab/apputils';

import {
  IEditorServices
} from '@quantlab/codeeditor';

import {
  IStateDB, PageConfig, URLExt, uuid
} from '@quantlab/coreutils';

import  {
  IFileBrowserFactory
} from '@quantlab/filebrowser';

import {
  ILauncher
} from '@quantlab/launcher';

import {
  IMainMenu, IEditMenu, IFileMenu, IKernelMenu, IRunMenu, IViewMenu
} from '@quantlab/mainmenu';

import {
  CellTools, ICellTools, INotebookTracker, NotebookActions,
  NotebookModelFactory,  NotebookPanel, NotebookTracker, NotebookWidgetFactory
} from '@quantlab/notebook';

import {
  ServiceManager
} from '@quantlab/services';

import {
  ReadonlyJSONObject
} from '@phosphor/coreutils';

import {
  Message, MessageLoop
} from '@phosphor/messaging';

import {
  Menu, Panel, Widget
} from '@phosphor/widgets';



/**
 * The command IDs used by the notebook plugin.
 */
namespace CommandIDs {
  export
  const createNew = 'notebook:create-new';

  export
  const interrupt = 'notebook:interrupt-kernel';

  export
  const restart = 'notebook:restart-kernel';

  export
  const restartClear = 'notebook:restart-clear-output';

  export
  const restartRunAll = 'notebook:restart-run-all';

  export
  const reconnectToKernel = 'notebook:reconnect-to-kernel';

  export
  const changeKernel = 'notebook:change-kernel';

  export
  const createConsole = 'notebook:create-console';

  export
  const createCellView = 'notebook:create-cell-view';

  export
  const clearAllOutputs = 'notebook:clear-all-cell-outputs';

  export
  const closeAndShutdown = 'notebook:close-and-shutdown';

  export
  const trust = 'notebook:trust';

  export
  const exportToFormat = 'notebook:export-to-format';

  export
  const run = 'notebook:run-cell';

  export
  const runAndAdvance = 'notebook:run-cell-and-select-next';

  export
  const runAndInsert = 'notebook:run-cell-and-insert-below';

  export
  const runAll = 'notebook:run-all-cells';

  export
  const toCode = 'notebook:change-cell-to-code';

  export
  const toMarkdown = 'notebook:change-cell-to-markdown';

  export
  const toRaw = 'notebook:change-cell-to-raw';

  export
  const cut = 'notebook:cut-cell';

  export
  const copy = 'notebook:copy-cell';

  export
  const paste = 'notebook:paste-cell';

  export
  const moveUp = 'notebook:move-cell-up';

  export
  const moveDown = 'notebook:move-cell-down';

  export
  const clearOutputs = 'notebook:clear-cell-output';

  export
  const deleteCell = 'notebook:delete-cell';

  export
  const insertAbove = 'notebook:insert-cell-above';

  export
  const insertBelow = 'notebook:insert-cell-below';

  export
  const selectAbove = 'notebook:move-cursor-up';

  export
  const selectBelow = 'notebook:move-cursor-down';

  export
  const extendAbove = 'notebook:extend-marked-cells-above';

  export
  const extendBelow = 'notebook:extend-marked-cells-below';

  export
  const editMode = 'notebook:enter-edit-mode';

  export
  const merge = 'notebook:merge-cells';

  export
  const split = 'notebook:split-cell-at-cursor';

  export
  const commandMode = 'notebook:enter-command-mode';

  export
  const toggleAllLines = 'notebook:toggle-all-cell-line-numbers';

  export
  const undoCellAction = 'notebook:undo-cell-action';

  export
  const redoCellAction = 'notebook:redo-cell-action';

  export
  const markdown1 = 'notebook:change-cell-to-heading-1';

  export
  const markdown2 = 'notebook:change-cell-to-heading-2';

  export
  const markdown3 = 'notebook:change-cell-to-heading-3';

  export
  const markdown4 = 'notebook:change-cell-to-heading-4';

  export
  const markdown5 = 'notebook:change-cell-to-heading-5';

  export
  const markdown6 = 'notebook:change-cell-to-heading-6';

  export
  const hideCode = 'notebook:hide-cell-code';

  export
  const showCode = 'notebook:show-cell-code';

  export
  const hideAllCode = 'notebook:hide-all-cell-code';

  export
  const showAllCode = 'notebook:show-all-cell-code';

  export
  const hideOutput = 'notebook:hide-cell-outputs';

  export
  const showOutput = 'notebook:show-cell-outputs';

  export
  const hideAllOutputs = 'notebook:hide-all-cell-outputs';

  export
  const showAllOutputs = 'notebook:show-all-cell-outputs';

}


/**
 * The class name for the notebook icon from the default theme.
 */
const NOTEBOOK_ICON_CLASS = 'jp-NotebookRunningIcon';

/**
 * The name of the factory that creates notebooks.
 */
const FACTORY = 'Notebook';

/**
 * The allowed Export To ... formats and their human readable labels.
 */
const EXPORT_TO_FORMATS = [
  { 'format': 'html', 'label': 'HTML' },
  { 'format': 'latex', 'label': 'LaTeX' },
  { 'format': 'markdown', 'label': 'Markdown' },
  { 'format': 'pdf', 'label': 'PDF' },
  { 'format': 'rst', 'label': 'ReStructured Text' },
  { 'format': 'script', 'label': 'Executable Script' },
  { 'format': 'slides', 'label': 'Reveal JS' }
];


/**
 * The notebook widget tracker provider.
 */
const tracker: QuantLabPlugin<INotebookTracker> = {
  id: '@quantlab/notebook-extension:tracker',
  provides: INotebookTracker,
  requires: [
    IMainMenu,
    ICommandPalette,
    NotebookPanel.IContentFactory,
    IEditorServices,
    ILayoutRestorer
  ],
  optional: [IFileBrowserFactory, ILauncher],
  activate: activateNotebookHandler,
  autoStart: true
};


/**
 * The notebook cell factory provider.
 */
const factory: QuantLabPlugin<NotebookPanel.IContentFactory> = {
  id: '@quantlab/notebook-extension:factory',
  provides: NotebookPanel.IContentFactory,
  requires: [IEditorServices],
  autoStart: true,
  activate: (app: QuantLab, editorServices: IEditorServices) => {
    let editorFactory = editorServices.factoryService.newInlineEditor.bind(
      editorServices.factoryService);
    return new NotebookPanel.ContentFactory({ editorFactory });
  }
};

/**
 * The cell tools extension.
 */
const tools: QuantLabPlugin<ICellTools> = {
  activate: activateCellTools,
  provides: ICellTools,
  id: '@quantlab/notebook-extension:tools',
  autoStart: true,
  requires: [INotebookTracker, IEditorServices, IStateDB]
};


/**
 * Export the plugins as default.
 */
const plugins: QuantLabPlugin<any>[] = [factory, tracker, tools];
export default plugins;


/**
 * Activate the cell tools extension.
 */
function activateCellTools(app: QuantLab, tracker: INotebookTracker, editorServices: IEditorServices, state: IStateDB): Promise<ICellTools> {
  const id = 'cell-tools';
  const celltools = new CellTools({ tracker });
  const activeCellTool = new CellTools.ActiveCellTool();
  const slideShow = CellTools.createSlideShowSelector();
  const nbConvert = CellTools.createNBConvertSelector();
  const editorFactory = editorServices.factoryService.newInlineEditor
    .bind(editorServices.factoryService);
  const metadataEditor = new CellTools.MetadataEditorTool({ editorFactory });

  // Create message hook for triggers to save to the database.
  const hook = (sender: any, message: Message): boolean => {
    switch (message) {
      case Widget.Msg.ActivateRequest:
        state.save(id, { open: true });
        break;
      case Widget.Msg.AfterHide:
      case Widget.Msg.CloseRequest:
        state.remove(id);
        break;
      default:
        break;
    }
    return true;
  };

  celltools.title.label = 'Cell Tools';
  celltools.id = id;
  celltools.addItem({ tool: activeCellTool, rank: 1 });
  celltools.addItem({ tool: slideShow, rank: 2 });
  celltools.addItem({ tool: nbConvert, rank: 3 });
  celltools.addItem({ tool: metadataEditor, rank: 4 });
  MessageLoop.installMessageHook(celltools, hook);

  // Wait until the application has finished restoring before rendering.
  Promise.all([state.fetch(id), app.restored]).then(([args]) => {
    const open = !!(args && (args as ReadonlyJSONObject)['open'] as boolean);

    // After initial restoration, check if the cell tools should render.
    if (tracker.size) {
      app.shell.addToLeftArea(celltools);
      if (open) {
        app.shell.activateById(celltools.id);
      }
    }

    // For all subsequent widget changes, check if the cell tools should render.
    app.shell.currentChanged.connect((sender, args) => {
      // If there are any open notebooks, add cell tools to the side panel if
      // it is not already there.
      if (tracker.size) {
        if (!celltools.isAttached) {
          app.shell.addToLeftArea(celltools);
        }
        return;
      }
      // If there are no notebooks, close cell tools.
      celltools.close();
    });
  });

  return Promise.resolve(celltools);
}


/**
 * Activate the notebook handler extension.
 */
function activateNotebookHandler(app: QuantLab, mainMenu: IMainMenu, palette: ICommandPalette, contentFactory: NotebookPanel.IContentFactory, editorServices: IEditorServices, restorer: ILayoutRestorer, browserFactory: IFileBrowserFactory | null, launcher: ILauncher | null): INotebookTracker {
  const services = app.serviceManager;
  const factory = new NotebookWidgetFactory({
    name: FACTORY,
    fileTypes: ['notebook'],
    modelName: 'notebook',
    defaultFor: ['notebook'],
    preferKernel: true,
    canStartKernel: true,
    rendermime: app.rendermime,
    contentFactory,
    mimeTypeService: editorServices.mimeTypeService
  });
  const { commands } = app;
  const tracker = new NotebookTracker({ namespace: 'notebook' });

  // Handle state restoration.
  restorer.restore(tracker, {
    command: 'docmanager:open',
    args: panel => ({ path: panel.context.path, factory: FACTORY }),
    name: panel => panel.context.path,
    when: services.ready
  });

  let registry = app.docRegistry;
  registry.addModelFactory(new NotebookModelFactory({}));
  registry.addWidgetFactory(factory);

  addCommands(app, services, tracker);
  populatePalette(palette);

  let id = 0; // The ID counter for notebook panels.
  factory.widgetCreated.connect((sender, widget) => {
    // If the notebook panel does not have an ID, assign it one.
    widget.id = widget.id || `notebook-${++id}`;
    widget.title.icon = NOTEBOOK_ICON_CLASS;
    // Notify the instance tracker if restore data needs to update.
    widget.context.pathChanged.connect(() => { tracker.save(widget); });
    // Add the notebook panel to the tracker.
    tracker.add(widget);
  });

  // Add main menu notebook menu.
  populateMenus(app, mainMenu, tracker);

  // Utility function to create a new notebook.
  const createNew = (cwd: string, kernelName?: string) => {
    return commands.execute(
      'docmanager:new-untitled', { path: cwd, type: 'notebook' }
    ).then(model => {
      return commands.execute('docmanager:open', {
        path: model.path, factory: FACTORY,
        kernel: { name: kernelName }
      });
    });
  };

  // Add a command for creating a new notebook in the File Menu.
  commands.addCommand(CommandIDs.createNew, {
    label: 'Notebook',
    caption: 'Create a new notebook',
    execute: () => {
      let cwd = browserFactory ?
        browserFactory.defaultBrowser.model.path : '';
      return createNew(cwd);
    }
  });


  // Add a launcher item if the launcher is available.
  if (launcher) {
    services.ready.then(() => {
      const specs = services.specs;
      const baseUrl = PageConfig.getBaseUrl();

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
          category: 'Notebook',
          name,
          iconClass: 'jp-NotebookRunningIcon',
          callback: createNew,
          rank,
          kernelIconUrl
        });
      }
    });
  }

  app.contextMenu.addItem({
    command: CommandIDs.clearOutputs,
    selector: '.jp-Notebook .jp-Cell'
  });
  app.contextMenu.addItem({
    command: CommandIDs.split,
    selector: '.jp-Notebook .jp-Cell'
  });
  app.contextMenu.addItem({
    command: CommandIDs.createCellView,
    selector: '.jp-Notebook .jp-Cell'
  });
  app.contextMenu.addItem({
    type: 'separator',
    selector: '.jp-Notebook',
    rank: 0
  });
  app.contextMenu.addItem({
    command: CommandIDs.undoCellAction,
    selector: '.jp-Notebook',
    rank: 1
  });
  app.contextMenu.addItem({
    command: CommandIDs.redoCellAction,
    selector: '.jp-Notebook',
    rank: 2
  });
  app.contextMenu.addItem({
    type: 'separator',
    selector: '.jp-Notebook',
    rank: 0
  });
  app.contextMenu.addItem({
    command: CommandIDs.createConsole,
    selector: '.jp-Notebook',
    rank: 3
  });
  app.contextMenu.addItem({
    command: CommandIDs.clearAllOutputs,
    selector: '.jp-Notebook',
    rank: 3
  });

  return tracker;
}



/**
 * Add the notebook commands to the application's command registry.
 */
function addCommands(app: QuantLab, services: ServiceManager, tracker: NotebookTracker): void {
  const { commands, shell } = app;

  // Get the current widget and activate unless the args specify otherwise.
  function getCurrent(args: ReadonlyJSONObject): NotebookPanel | null {
    const widget = tracker.currentWidget;
    const activate = args['activate'] !== false;

    if (activate && widget) {
      shell.activateById(widget.id);
    }

    return widget;
  }

  /**
   * Whether there is an active notebook.
   */
  function isEnabled(): boolean {
    return tracker.currentWidget !== null &&
           tracker.currentWidget === app.shell.currentWidget;
  }

  /**
   * The name of the current notebook widget.
   */
  function currentName(): string {
    if (tracker.currentWidget  &&
        tracker.currentWidget === app.shell.currentWidget &&
        tracker.currentWidget.title.label) {
      return `"${tracker.currentWidget.title.label}"`;
    }
    return 'Notebook';
  }

  commands.addCommand(CommandIDs.runAndAdvance, {
    label: 'Run Cell(s) and Select Below',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        const { context, notebook } = current;

        return NotebookActions.runAndAdvance(notebook, context.session);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.run, {
    label: 'Run Cell(s)',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        const { context, notebook } = current;

        return NotebookActions.run(notebook, context.session);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.runAndInsert, {
    label: 'Run Cell(s) and Insert Below',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        const { context, notebook } = current;

        return NotebookActions.runAndInsert(notebook, context.session);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.runAll, {
    label: 'Run All Cells',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        const { context, notebook } = current;

        return NotebookActions.runAll(notebook, context.session);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.restart, {
    label: 'Restart Kernel',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return current.session.restart();
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.closeAndShutdown, {
    label: 'Close and Shutdown',
    execute: args => {
      const current = getCurrent(args);

      if (!current) {
        return;
      }

      const fileName = current.title.label;

      return showDialog({
        title: 'Shutdown the notebook?',
        body: `Are you sure you want to close "${fileName}"?`,
        buttons: [Dialog.cancelButton(), Dialog.warnButton()]
      }).then(result => {
        if (result.button.accept) {
          return current.context.session.shutdown()
            .then(() => { current.dispose(); });
        }
      });
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.trust, {
    label: () => `Trust ${currentName()}`,
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        const { context, notebook } = current;

        return NotebookActions.trust(notebook).then(() => context.save());
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.exportToFormat, {
    label: args => {
        const formatLabel = (args['label']) as string;
        const name = currentName();

        return (args['isPalette'] ? `Export ${name} to ` : '') + formatLabel;
    },
    execute: args => {
      const current = getCurrent(args);

      if (!current) {
        return;
      }

      const notebookPath = URLExt.encodeParts(current.context.path);
      const url = URLExt.join(
        services.serverSettings.baseUrl,
        'nbconvert',
        (args['format']) as string,
        notebookPath
      ) + '?download=true';
      const child = window.open('', '_blank');
      const { context } = current;

      if (context.model.dirty && !context.model.readOnly) {
        return context.save().then(() => { child.location.assign(url); });
      }

      return new Promise<void>((resolve) => {
        child.location.assign(url);
        resolve(undefined);
      });
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.restartClear, {
    label: 'Restart Kernel & Clear Outputs',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        const { notebook, session } = current;

        return session.restart()
          .then(() => { NotebookActions.clearAllOutputs(notebook); });
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.restartRunAll, {
    label: 'Restart Kernel & Run All',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        const { context, notebook, session } = current;

        return session.restart()
          .then(() => { NotebookActions.runAll(notebook, context.session); });
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.clearAllOutputs, {
    label: 'Clear All Outputs',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.clearAllOutputs(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.clearOutputs, {
    label: 'Clear Output(s)',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.clearOutputs(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.interrupt, {
    label: 'Interrupt Kernel',
    execute: args => {
      const current = getCurrent(args);

      if (!current) {
        return;
      }

      const kernel = current.context.session.kernel;

      if (kernel) {
        return kernel.interrupt();
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.toCode, {
    label: 'Change to Code Cell Type',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.changeCellType(current.notebook, 'code');
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.toMarkdown, {
    label: 'Change to Markdown Cell Type',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.changeCellType(current.notebook, 'markdown');
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.toRaw, {
    label: 'Change to Raw Cell Type',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.changeCellType(current.notebook, 'raw');
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.cut, {
    label: 'Cut Cell(s)',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.cut(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.copy, {
    label: 'Copy Cell(s)',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.copy(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.paste, {
    label: 'Paste Cell(s) Below',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.paste(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.deleteCell, {
    label: 'Delete Cell(s)',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.deleteCells(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.split, {
    label: 'Split Cell',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.splitCell(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.merge, {
    label: 'Merge Selected Cell(s)',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.mergeCells(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.insertAbove, {
    label: 'Insert Cell Above',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.insertAbove(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.insertBelow, {
    label: 'Insert Cell Below',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.insertBelow(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.selectAbove, {
    label: 'Select Cell Above',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.selectAbove(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.selectBelow, {
    label: 'Select Cell Below',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.selectBelow(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.extendAbove, {
    label: 'Extend Selection Above',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.extendSelectionAbove(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.extendBelow, {
    label: 'Extend Selection Below',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.extendSelectionBelow(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.moveUp, {
    label: 'Move Cell(s) Up',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.moveUp(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.moveDown, {
    label: 'Move Cell(s) Down',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.moveDown(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.toggleAllLines, {
    label: 'Toggle All Line Numbers',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.toggleAllLineNumbers(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.commandMode, {
    label: 'Enter Command Mode',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        current.notebook.mode = 'command';
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.editMode, {
    label: 'Enter Edit Mode',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        current.notebook.mode = 'edit';
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.undoCellAction, {
    label: 'Undo Cell Operation',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.undo(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.redoCellAction, {
    label: 'Redo Cell Operation',
    execute: args => {
      const current = getCurrent(args);

      if (!current) {
        return NotebookActions.redo(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.changeKernel, {
    label: 'Change Kernel',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return current.context.session.selectKernel();
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.reconnectToKernel, {
    label: 'Reconnect To Kernel',
    execute: args => {
      const current = getCurrent(args);

      if (!current) {
        return;
      }

      const kernel = current.context.session.kernel;

      if (kernel) {
        return kernel.reconnect();
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.createCellView, {
    label: 'Create New View for Cell',
    execute: args => {
      const current = getCurrent(args);
      const nb = current.notebook;
      const newCell = nb.activeCell.clone();

      const CellPanel = class extends Panel {
        protected onCloseRequest(msg: Message): void {
          this.dispose();
        }
      };
      const p = new CellPanel();
      p.id = `Cell-${uuid()}`;
      p.title.closable = true;
      p.title.label = current.title.label ? `Cell: ${current.title.label}` : 'Cell';
      p.addWidget(newCell);
      shell.addToMainArea(p);
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.createConsole, {
    label: 'Create Console for Notebook',
    execute: args => {
      const current = getCurrent(args);
      const widget = tracker.currentWidget;

      if (!current || !widget) {
        return;
      }

      const options: ReadonlyJSONObject = {
        path: widget.context.path,
        preferredLanguage: widget.context.model.defaultKernelLanguage,
        activate: args['activate']
      };

      return commands.execute('console:create', options);
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.markdown1, {
    label: 'Change to Heading 1',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.setMarkdownHeader(current.notebook, 1);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.markdown2, {
    label: 'Change to Heading 2',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.setMarkdownHeader(current.notebook, 2);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.markdown3, {
    label: 'Change to Heading 3',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.setMarkdownHeader(current.notebook, 3);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.markdown4, {
    label: 'Change to Heading 4',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.setMarkdownHeader(current.notebook, 4);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.markdown5, {
    label: 'Change to Heading 5',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.setMarkdownHeader(current.notebook, 5);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.markdown6, {
    label: 'Change to Heading 6',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.setMarkdownHeader(current.notebook, 6);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.hideCode, {
    label: 'Hide Code',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.hideCode(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.showCode, {
    label: 'Show Code',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.showCode(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.hideAllCode, {
    label: 'Hide All Code',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.hideAllCode(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.showAllCode, {
    label: 'Show All Code',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.showAllCode(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.hideOutput, {
    label: 'Hide Output',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.hideOutput(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.showOutput, {
    label: 'Show Output',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.showOutput(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.hideAllOutputs, {
    label: 'Hide All Outputs',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.hideAllOutputs(current.notebook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.showAllOutputs, {
    label: 'Show All Outputs',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return NotebookActions.showAllOutputs(current.notebook);
      }
    },
    isEnabled
  });
}


/**
 * Populate the application's command palette with notebook commands.
 */
function populatePalette(palette: ICommandPalette): void {
  let category = 'Notebook Operations';
  [
    CommandIDs.interrupt,
    CommandIDs.restart,
    CommandIDs.restartClear,
    CommandIDs.restartRunAll,
    CommandIDs.runAll,
    CommandIDs.clearAllOutputs,
    CommandIDs.toggleAllLines,
    CommandIDs.editMode,
    CommandIDs.commandMode,
    CommandIDs.changeKernel,
    CommandIDs.reconnectToKernel,
    CommandIDs.createConsole,
    CommandIDs.closeAndShutdown,
    CommandIDs.trust
  ].forEach(command => { palette.addItem({ command, category }); });

  EXPORT_TO_FORMATS.forEach(exportToFormat => {
    let args = { 'format': exportToFormat['format'], 'label': exportToFormat['label'], 'isPalette': true };
    palette.addItem({ command: CommandIDs.exportToFormat, category: category, args: args });
  });

  category = 'Notebook Cell Operations';
  [
    CommandIDs.run,
    CommandIDs.runAndAdvance,
    CommandIDs.runAndInsert,
    CommandIDs.clearOutputs,
    CommandIDs.toCode,
    CommandIDs.toMarkdown,
    CommandIDs.toRaw,
    CommandIDs.cut,
    CommandIDs.copy,
    CommandIDs.paste,
    CommandIDs.deleteCell,
    CommandIDs.split,
    CommandIDs.merge,
    CommandIDs.insertAbove,
    CommandIDs.insertBelow,
    CommandIDs.selectAbove,
    CommandIDs.selectBelow,
    CommandIDs.extendAbove,
    CommandIDs.extendBelow,
    CommandIDs.moveDown,
    CommandIDs.moveUp,
    CommandIDs.undoCellAction,
    CommandIDs.redoCellAction,
    CommandIDs.markdown1,
    CommandIDs.markdown2,
    CommandIDs.markdown3,
    CommandIDs.markdown4,
    CommandIDs.markdown5,
    CommandIDs.markdown6,
    CommandIDs.hideCode,
    CommandIDs.showCode,
    CommandIDs.hideAllCode,
    CommandIDs.showAllCode,
    CommandIDs.hideOutput,
    CommandIDs.showOutput,
    CommandIDs.hideAllOutputs,
    CommandIDs.showAllOutputs,
  ].forEach(command => { palette.addItem({ command, category }); });
}


/**
 * Populates the application menus for the notebook.
 */
function populateMenus(app: QuantLab, mainMenu: IMainMenu, tracker: INotebookTracker): void {
  let { commands } = app;

  // Add undo/redo hooks to the edit menu.
  mainMenu.editMenu.undoers.add({
    tracker,
    undo: widget => { widget.notebook.activeCell.editor.undo(); },
    redo: widget => { widget.notebook.activeCell.editor.redo(); }
  } as IEditMenu.IUndoer<NotebookPanel>);

  // Add a clearer to the edit menu
  mainMenu.editMenu.clearers.add({
    tracker,
    noun: 'All Cell Outputs',
    clear: (current: NotebookPanel) => {
      return NotebookActions.clearAllOutputs(current.notebook);
    }
  } as IEditMenu.IClearer<NotebookPanel>);

  // Add new notebook creation to the file menu.
  mainMenu.fileMenu.newMenu.addItem({ command: CommandIDs.createNew });

  // Add a close and shutdown command to the file menu.
  mainMenu.fileMenu.closeAndCleaners.add({
    tracker,
    action: 'Shutdown',
    closeAndCleanup: (current: NotebookPanel) => {
      const fileName = current.title.label;
      return showDialog({
        title: 'Shutdown the notebook?',
        body: `Are you sure you want to close "${fileName}"?`,
        buttons: [Dialog.cancelButton(), Dialog.warnButton()]
      }).then(result => {
        if (result.button.accept) {
          return current.context.session.shutdown()
            .then(() => { current.dispose(); });
        }
      });
    }
  } as IFileMenu.ICloseAndCleaner<NotebookPanel>);

  // Add a notebook group to the File menu.
  let exportTo = new Menu({ commands } );
  exportTo.title.label = 'Export to ...';
  EXPORT_TO_FORMATS.forEach(exportToFormat => {
    exportTo.addItem({ command: CommandIDs.exportToFormat, args: exportToFormat });
  });
  const fileGroup = [
    { command: CommandIDs.trust },
    { type: 'submenu', submenu: exportTo } as Menu.IItemOptions
  ];
  mainMenu.fileMenu.addGroup(fileGroup, 10);

  // Add a kernel user to the Kernel menu
  mainMenu.kernelMenu.kernelUsers.add({
    tracker,
    interruptKernel: current => {
      let kernel = current.session.kernel;
      if (kernel) {
        return kernel.interrupt();
      }
      return Promise.resolve(void 0);
    },
    restartKernel: current => current.session.restart(),
    changeKernel: current => current.session.selectKernel(),
    shutdownKernel: current => current.session.shutdown(),
  } as IKernelMenu.IKernelUser<NotebookPanel>);

  // Add a console creator the the Kernel menu
  mainMenu.kernelMenu.consoleCreators.add({
    tracker,
    createConsole: current => {
      const options: ReadonlyJSONObject = {
        path: current.context.path,
        preferredLanguage: current.context.model.defaultKernelLanguage
      };
      return commands.execute('console:create', options);
    }
  } as IKernelMenu.IConsoleCreator<NotebookPanel>);

  // Add some commands to the application view menu.
  const viewGroup = [
    CommandIDs.hideAllCode,
    CommandIDs.showAllCode,
    CommandIDs.hideAllOutputs,
    CommandIDs.showAllOutputs
  ].map(command => { return { command }; });
  mainMenu.viewMenu.addGroup(viewGroup, 10);

  // Add an IEditorViewer to the application view menu
  mainMenu.viewMenu.editorViewers.add({
    tracker,
    toggleLineNumbers: widget => {
      NotebookActions.toggleAllLineNumbers(widget.notebook);
    },
    toggleMatchBrackets: widget => {
      NotebookActions.toggleAllMatchBrackets(widget.notebook);
    },
    lineNumbersToggled: widget =>
      widget.notebook.activeCell.editor.getOption('lineNumbers'),
    matchBracketsToggled: widget =>
      widget.notebook.activeCell.editor.getOption('matchBrackets'),
  } as IViewMenu.IEditorViewer<NotebookPanel>);

  // Add an ICodeRunner to the application run menu
  mainMenu.runMenu.codeRunners.add({
    tracker,
    noun: 'Cell(s)',
    pluralNoun: 'Cells',
    run: current => {
      const { context, notebook } = current;
      return NotebookActions.runAndAdvance(notebook, context.session)
      .then(() => void 0);
    },
    runAll: current => {
      const { context, notebook } = current;
      return NotebookActions.runAll(notebook, context.session)
      .then(() => void 0);
    },
    runAbove: current => {
      const { context, notebook } = current;
      return NotebookActions.runAllAbove(notebook, context.session)
      .then(() => void 0);
    },
    runBelow: current => {
      const { context, notebook } = current;
      return NotebookActions.runAllBelow(notebook, context.session)
      .then(() => void 0);
    }
  } as IRunMenu.ICodeRunner<NotebookPanel>);

  // Add commands to the application edit menu.
  const undoCellActionGroup = [
    CommandIDs.undoCellAction,
    CommandIDs.redoCellAction
  ].map(command => { return { command }; });
  const editGroup = [
    CommandIDs.cut,
    CommandIDs.copy,
    CommandIDs.paste,
    CommandIDs.deleteCell,
    CommandIDs.split,
    CommandIDs.merge
  ].map(command => { return { command }; });
  mainMenu.editMenu.addGroup(undoCellActionGroup, 4);
  mainMenu.editMenu.addGroup(editGroup, 5);
}
