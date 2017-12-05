/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import {
  ILayoutRestorer, QuantLab, QuantLabPlugin
} from '@quantlab/application';

import {
  InstanceTracker
} from '@quantlab/apputils';

import {
  IEditorServices
} from '@quantlab/codeeditor';

import {
  ISettingRegistry, IStateDB
} from '@quantlab/coreutils';

import {
  ISettingEditorTracker, SettingEditor
} from '@quantlab/settingeditor';


/**
 * The command IDs used by the setting editor.
 */
namespace CommandIDs {
  export
  const debug = 'settingeditor:debug';

  export
  const open = 'settingeditor:open';

  export
  const revert = 'settingeditor:revert';

  export
  const save = 'settingeditor:save';
}


/**
 * The default setting editor extension.
 */
const plugin: QuantLabPlugin<ISettingEditorTracker> = {
  id: '@quantlab/settingeditor-extension:plugin',
  activate: (app: QuantLab, restorer: ILayoutRestorer, registry: ISettingRegistry, editorServices: IEditorServices, state: IStateDB) => {
    const { commands, rendermime, shell } = app;
    const namespace = 'setting-editor';
    const factoryService = editorServices.factoryService;
    const editorFactory = factoryService.newInlineEditor.bind(factoryService);
    const tracker = new InstanceTracker<SettingEditor>({ namespace });
    let editor: SettingEditor;

    // Handle state restoration.
    restorer.restore(tracker, {
      command: CommandIDs.open,
      args: widget => ({ }),
      name: widget => namespace
    });

    commands.addCommand(CommandIDs.debug, {
      execute: () => { tracker.currentWidget.toggleDebug(); },
      iconClass: 'jp-MaterialIcon jp-BugIcon',
      label: 'Debug user settings in inspector',
      isToggled: () => tracker.currentWidget.isDebugVisible
    });

    commands.addCommand(CommandIDs.open, {
      execute: () => {
        if (tracker.currentWidget) {
          shell.activateById(tracker.currentWidget.id);
          return;
        }

        const key = plugin.id;
        const when = app.restored;

        editor = new SettingEditor({
          commands: {
            registry: commands,
            debug: CommandIDs.debug,
            revert: CommandIDs.revert,
            save: CommandIDs.save
          },
          editorFactory, key, registry, rendermime, state, when
        });

        // Notify the command registry when the visibility status of the setting
        // editor's commands change. The setting editor toolbar listens for this
        // signal from the command registry.
        editor.commandsChanged.connect((sender: any, args: string[]) => {
          args.forEach(id => { commands.notifyCommandChanged(id); });
        });

        tracker.add(editor);
        editor.id = namespace;
        editor.title.label = 'Settings';
        editor.title.iconClass = 'jp-SettingsIcon';
        editor.title.closable = true;
        shell.addToMainArea(editor);
        shell.activateById(editor.id);
      },
      label: 'Settings'
    });

    commands.addCommand(CommandIDs.revert, {
      execute: () => { tracker.currentWidget.revert(); },
      iconClass: 'jp-MaterialIcon jp-RefreshIcon',
      label: 'Revert user settings',
      isEnabled: () => tracker.currentWidget.canRevertRaw
    });

    commands.addCommand(CommandIDs.save, {
      execute: () => tracker.currentWidget.save(),
      iconClass: 'jp-MaterialIcon jp-SaveIcon',
      label: 'Save user settings',
      isEnabled: () => tracker.currentWidget.canSaveRaw
    });

    return tracker;
  },
  requires: [ILayoutRestorer, ISettingRegistry, IEditorServices, IStateDB],
  autoStart: true,
  provides: ISettingEditorTracker
};

export default plugin;
