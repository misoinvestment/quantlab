// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
import {
  JSONObject
} from '@phosphor/coreutils';

import {
  Menu
} from '@phosphor/widgets';

import {
  QuantLab, QuantLabPlugin
} from '@quantlab/application';

import {
  ICommandPalette
} from '@quantlab/apputils';

import {
  IMainMenu, IEditMenu
} from '@quantlab/mainmenu';

import {
  IEditorServices
} from '@quantlab/codeeditor';

import {
  editorServices, CodeMirrorEditor, Mode
} from '@quantlab/codemirror';

import {
  ISettingRegistry, IStateDB
} from '@quantlab/coreutils';

import {
  IEditorTracker, FileEditor
} from '@quantlab/fileeditor';


/**
 * The command IDs used by the codemirror plugin.
 */
namespace CommandIDs {
  export
  const changeKeyMap = 'codemirror:change-keymap';

  export
  const changeTheme = 'codemirror:change-theme';

  export
  const changeMode = 'codemirror:change-mode';

  export
  const find = 'codemirror:find';

  export
  const findAndReplace = 'codemirror:find-and-replace';
}


/**
 * The editor services.
 */
const services: QuantLabPlugin<IEditorServices> = {
  id: '@quantlab/codemirror-extension:services',
  provides: IEditorServices,
  activate: (): IEditorServices => editorServices
};


/**
 * The editor commands.
 */
const commands: QuantLabPlugin<void> = {
  id: '@quantlab/codemirror-extension:commands',
  requires: [
    IEditorTracker,
    IMainMenu,
    ICommandPalette,
    IStateDB,
    ISettingRegistry
  ],
  activate: activateEditorCommands,
  autoStart: true
};


/**
 * Export the plugins as default.
 */
const plugins: QuantLabPlugin<any>[] = [commands, services];
export default plugins;


/**
 * The plugin ID used as the key in the setting registry.
 */
const id = commands.id;

/**
 * Set up the editor widget menu and commands.
 */
function activateEditorCommands(app: QuantLab, tracker: IEditorTracker, mainMenu: IMainMenu, palette: ICommandPalette, state: IStateDB, settingRegistry: ISettingRegistry): void {
  const { commands, restored } = app;
  let { theme, keyMap } = CodeMirrorEditor.defaultConfig;

  /**
   * Update the setting values.
   */
  function updateSettings(settings: ISettingRegistry.ISettings): void {
    keyMap = settings.get('keyMap').composite as string | null || keyMap;
    theme = settings.get('theme').composite as string | null || theme;
  }

  /**
   * Update the settings of the current tracker instances.
   */
  function updateTracker(): void {
    tracker.forEach(widget => {
      if (widget.editor instanceof CodeMirrorEditor) {
        let cm = widget.editor.editor;
        cm.setOption('keyMap', keyMap);
        cm.setOption('theme', theme);
      }
    });
  }

  // Fetch the initial state of the settings.
  Promise.all([settingRegistry.load(id), restored]).then(([settings]) => {
    updateSettings(settings);
    updateTracker();
    settings.changed.connect(() => {
      updateSettings(settings);
      updateTracker();
    });
  }).catch((reason: Error) => {
    console.error(reason.message);
    updateTracker();
  });

  /**
   * Handle the settings of new widgets.
   */
  tracker.widgetAdded.connect((sender, widget) => {
    if (widget.editor instanceof CodeMirrorEditor) {
      let cm = widget.editor.editor;
      cm.setOption('keyMap', keyMap);
      cm.setOption('theme', theme);
    }
  });

  /**
   * A test for whether the tracker has an active widget.
   */
  function isEnabled(): boolean {
    return tracker.currentWidget !== null &&
           tracker.currentWidget === app.shell.currentWidget;
  }

  /**
   * Create a menu for the editor.
   */
  function createMenu(): Menu {
    const menu = new Menu({ commands });
    const themeMenu = new Menu({ commands });
    const keyMapMenu = new Menu({ commands });
    const modeMenu = new Menu({ commands });
    const tabMenu = new Menu({ commands });

    menu.title.label = 'Editor';
    themeMenu.title.label = 'Theme';
    keyMapMenu.title.label = 'Key Map';
    modeMenu.title.label = 'Language';
    tabMenu.title.label = 'Tabs';

    commands.addCommand(CommandIDs.changeTheme, {
      label: args => args['theme'] as string,
      execute: args => {
        const key = 'theme';
        const value = theme = args['theme'] as string || theme;

        updateTracker();
        return settingRegistry.set(id, key, value).catch((reason: Error) => {
          console.error(`Failed to set ${id}:${key} - ${reason.message}`);
        });
      },
      isEnabled,
      isToggled: args => args['theme'] === theme
    });

    commands.addCommand(CommandIDs.changeKeyMap, {
      label: args => {
        let title = args['keyMap'] as string;
        return title === 'sublime' ? 'Sublime Text' : title;
      },
      execute: args => {
        const key = 'keyMap';
        const value = keyMap = args['keyMap'] as string || keyMap;

        updateTracker();
        return settingRegistry.set(id, key, value).catch((reason: Error) => {
          console.error(`Failed to set ${id}:${key} - ${reason.message}`);
        });
      },
      isEnabled,
      isToggled: args => args['keyMap'] === keyMap
    });

    commands.addCommand(CommandIDs.find, {
      label: 'Find...',
      execute: () => {
        let widget = tracker.currentWidget;
        if (!widget) {
          return;
        }
        let editor = widget.editor as CodeMirrorEditor;
        editor.execCommand('find');
      },
      isEnabled
    });

    commands.addCommand(CommandIDs.findAndReplace, {
      label: 'Find & Replace...',
      execute: () => {
        let widget = tracker.currentWidget;
        if (!widget) {
          return;
        }
        let editor = widget.editor as CodeMirrorEditor;
        editor.execCommand('replace');
      },
      isEnabled
    });

    commands.addCommand(CommandIDs.changeMode, {
      label: args => args['name'] as string,
      execute: args => {
        let name = args['name'] as string;
        let widget = tracker.currentWidget;
        if (name && widget) {
          let spec = Mode.findByName(name);
          if (spec) {
            widget.model.mimeType = spec.mime;
          }
        }
      },
      isEnabled,
      isToggled: args => {
        let widget = tracker.currentWidget;
        if (!widget) {
          return false;
        }
        let mime = widget.model.mimeType;
        let spec = Mode.findByMIME(mime);
        let name = spec && spec.name;
        return args['name'] === name;
      }
    });

    Mode.getModeInfo().sort((a, b) => {
      let aName = a.name || '';
      let bName = b.name || '';
      return aName.localeCompare(bName);
    }).forEach(spec => {
      // Avoid mode name with a curse word.
      if (spec.mode.indexOf('brainf') === 0) {
        return;
      }
      modeMenu.addItem({
        command: CommandIDs.changeMode,
        args: {...spec}
      });
    });

    [
     'jupyter', 'default', 'abcdef', 'base16-dark', 'base16-light',
     'hopscotch', 'material', 'mbo', 'mdn-like', 'seti', 'the-matrix',
     'xq-light', 'zenburn'
    ].forEach(name => themeMenu.addItem({
      command: CommandIDs.changeTheme,
      args: { theme: name }
    }));

    ['default', 'sublime', 'vim', 'emacs'].forEach(name => {
      keyMapMenu.addItem({
        command: CommandIDs.changeKeyMap,
        args: { keyMap: name }
      });
    });

    let args: JSONObject = {
      insertSpaces: false, size: 4, name: 'Indent with Tab'
    };
    let command = 'fileeditor:change-tabs';
    tabMenu.addItem({ command, args });
    palette.addItem({ command, args, category: 'Editor' });

    for (let size of [1, 2, 4, 8]) {
      let args: JSONObject = {
        insertSpaces: true, size, name: `Spaces: ${size} `
      };
      tabMenu.addItem({ command, args });
      palette.addItem({ command, args, category: 'Editor' });
    }

    menu.addItem({ command: 'fileeditor:toggle-autoclosing-brackets' });
    menu.addItem({ type: 'submenu', submenu: tabMenu });
    menu.addItem({ type: 'separator' });
    menu.addItem({ type: 'submenu', submenu: modeMenu });
    menu.addItem({ type: 'submenu', submenu: keyMapMenu });
    menu.addItem({ type: 'submenu', submenu: themeMenu });

    return menu;
  }

  mainMenu.addMenu(createMenu(), { rank: 30 });

  // Add find-replace capabilities to the edit menu.
  mainMenu.editMenu.findReplacers.add({
    tracker,
    find: (widget: FileEditor) => {
      let editor = widget.editor as CodeMirrorEditor;
      editor.execCommand('find');
    },
    findAndReplace: (widget: FileEditor) => {
      let editor = widget.editor as CodeMirrorEditor;
      editor.execCommand('replace');
    }
  } as IEditMenu.IFindReplacer<FileEditor>)
}
