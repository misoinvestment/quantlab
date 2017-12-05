// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
import {
  ILayoutRestorer, QuantLab, QuantLabPlugin
} from '@quantlab/application';

import {
  ICommandPalette, InstanceTracker
} from '@quantlab/apputils';

import {
  IConsoleTracker
} from '@quantlab/console';

import {
  IInspector, InspectionHandler, InspectorPanel, KernelConnector
} from '@quantlab/inspector';

import {
  INotebookTracker
} from '@quantlab/notebook';

import {
  InspectorManager
} from './manager';


/**
 * The command IDs used by the inspector plugin.
 */
namespace CommandIDs {
  export
  const open = 'inspector:open';
}


/**
 * A service providing code introspection.
 */
const inspector: QuantLabPlugin<IInspector> = {
  id: '@quantlab/inspector-extension:inspector',
  requires: [ICommandPalette, ILayoutRestorer],
  provides: IInspector,
  autoStart: true,
  activate: (app: QuantLab, palette: ICommandPalette, restorer: ILayoutRestorer): IInspector => {
    const { commands, shell } = app;
    const manager = new InspectorManager();
    const category = 'Inspector';
    const command = CommandIDs.open;
    const label = 'Open Inspector';
    const namespace = 'inspector';
    const tracker = new InstanceTracker<InspectorPanel>({ namespace });

    /**
     * Create and track a new inspector.
     */
    function newInspectorPanel(): InspectorPanel {
      const inspector = new InspectorPanel();

      inspector.id = 'jp-inspector';
      inspector.title.label = 'Inspector';
      inspector.title.closable = true;
      inspector.disposed.connect(() => {
        if (manager.inspector === inspector) {
          manager.inspector = null;
        }
      });

      // Track the inspector.
      tracker.add(inspector);

      // Add the default inspector child items.
      Private.defaultInspectorItems.forEach(item => { inspector.add(item); });

      return inspector;
    }

    // Handle state restoration.
    restorer.restore(tracker, {
      command,
      args: () => null,
      name: () => 'inspector'
    });

    // Add command to registry and palette.
    commands.addCommand(command, {
      label,
      execute: () => {
        if (!manager.inspector || manager.inspector.isDisposed) {
          manager.inspector = newInspectorPanel();
          shell.addToMainArea(manager.inspector);
        }
        if (manager.inspector.isAttached) {
          shell.activateById(manager.inspector.id);
        }
      }
    });
    palette.addItem({ command, category });

    return manager;
  }
};

/**
 * An extension that registers consoles for inspection.
 */
const consoles: QuantLabPlugin<void> = {
  id: '@quantlab/inspector-extension:consoles',
  requires: [IInspector, IConsoleTracker],
  autoStart: true,
  activate: (app: QuantLab, manager: IInspector, consoles: IConsoleTracker): void => {
    // Maintain association of new consoles with their respective handlers.
    const handlers: { [id: string]: InspectionHandler } = {};

    // Create a handler for each console that is created.
    consoles.widgetAdded.connect((sender, parent) => {
      const session = parent.console.session;
      const rendermime = parent.console.rendermime;
      const connector = new KernelConnector({ session });
      const handler = new InspectionHandler({ connector, rendermime });

      // Associate the handler to the widget.
      handlers[parent.id] = handler;

      // Set the initial editor.
      let cell = parent.console.promptCell;
      handler.editor = cell && cell.editor;

      // Listen for prompt creation.
      parent.console.promptCellCreated.connect((sender, cell) => {
        handler.editor = cell && cell.editor;
      });

      // Listen for parent disposal.
      parent.disposed.connect(() => {
        delete handlers[parent.id];
        handler.dispose();
      });
    });

    // Keep track of console instances and set inspector source.
    app.shell.currentChanged.connect((sender, args) => {
      let widget = args.newValue;
      if (!widget || !consoles.has(widget)) {
        return;
      }
      let source = handlers[widget.id];
      if (source) {
        manager.source = source;
      }
    });

    app.contextMenu.addItem({
      command: CommandIDs.open,
      selector: '.jp-CodeConsole'
    });
  }
};

/**
 * An extension that registers notebooks for inspection.
 */
const notebooks: QuantLabPlugin<void> = {
  id: '@quantlab/inspector-extension:notebooks',
  requires: [IInspector, INotebookTracker],
  autoStart: true,
  activate: (app: QuantLab, manager: IInspector, notebooks: INotebookTracker): void => {
    // Maintain association of new notebooks with their respective handlers.
    const handlers: { [id: string]: InspectionHandler } = {};

    // Create a handler for each notebook that is created.
    notebooks.widgetAdded.connect((sender, parent) => {
      const session = parent.session;
      const rendermime = parent.rendermime;
      const connector = new KernelConnector({ session });
      const handler = new InspectionHandler({ connector, rendermime });

      // Associate the handler to the widget.
      handlers[parent.id] = handler;

      // Set the initial editor.
      let cell = parent.notebook.activeCell;
      handler.editor = cell && cell.editor;

      // Listen for active cell changes.
      parent.notebook.activeCellChanged.connect((sender, cell) => {
        handler.editor = cell && cell.editor;
      });

      // Listen for parent disposal.
      parent.disposed.connect(() => {
        delete handlers[parent.id];
        handler.dispose();
      });
    });

    // Keep track of notebook instances and set inspector source.
    app.shell.currentChanged.connect((sender, args) => {
      let widget = args.newValue;
      if (!widget || !notebooks.has(widget)) {
        return;
      }
      let source = handlers[widget.id];
      if (source) {
        manager.source = source;
      }
    });

    app.contextMenu.addItem({
      command: CommandIDs.open,
      selector: '.jp-NotebookPanel'
    });
  }
};

/**
 * Export the plugins as default.
 */
const plugins: QuantLabPlugin<any>[] = [inspector, consoles, notebooks];
export default plugins;


/**
 * A namespace for private data.
 */
namespace Private {
  /**
   * The default set of inspector items added to the inspector panel.
   */
  export
  const defaultInspectorItems: IInspector.IInspectorItem[] = [
    {
      className: 'jp-HintsInspectorItem',
      name: 'Hints',
      rank: 20,
      type: 'hints'
    }
  ];
}
