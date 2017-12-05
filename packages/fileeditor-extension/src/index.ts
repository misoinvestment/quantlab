// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
import {
  ILayoutRestorer, QuantLab, QuantLabPlugin
} from '@quantlab/application';

import {
  InstanceTracker
} from '@quantlab/apputils';

import {
  CodeEditor, IEditorServices
} from '@quantlab/codeeditor';

import {
  ISettingRegistry, MarkdownCodeBlocks, PathExt
} from '@quantlab/coreutils';

import {
  IFileBrowserFactory
} from '@quantlab/filebrowser';

import {
  FileEditor, FileEditorFactory, IEditorTracker
} from '@quantlab/fileeditor';

import {
  ILauncher
} from '@quantlab/launcher';

import {
  IEditMenu, IMainMenu, IKernelMenu, IViewMenu
} from '@quantlab/mainmenu';


/**
 * The class name for the text editor icon from the default theme.
 */
const EDITOR_ICON_CLASS = 'jp-TextEditorIcon';

/**
 * The name of the factory that creates editor widgets.
 */
const FACTORY = 'Editor';


/**
 * The command IDs used by the fileeditor plugin.
 */
namespace CommandIDs {
  export
  const createNew = 'fileeditor:create-new';

  export
  const lineNumbers = 'fileeditor:toggle-line-numbers';

  export
  const lineWrap = 'fileeditor:toggle-line-wrap';

  export
  const changeTabs = 'fileeditor:change-tabs';

  export
  const matchBrackets = 'fileeditor:toggle-match-brackets';

  export
  const autoClosingBrackets = 'fileeditor:toggle-autoclosing-brackets';

  export
  const createConsole = 'fileeditor:create-console';

  export
  const runCode = 'fileeditor:run-code';

  export
  const markdownPreview = 'fileeditor:markdown-preview';
}


/**
 * The editor tracker extension.
 */
const plugin: QuantLabPlugin<IEditorTracker> = {
  activate,
  id: '@quantlab/fileeditor-extension:plugin',
  requires: [IEditorServices, IFileBrowserFactory, ILayoutRestorer, ISettingRegistry],
  optional: [ILauncher, IMainMenu],
  provides: IEditorTracker,
  autoStart: true
};


/**
 * Export the plugins as default.
 */
export default plugin;


/**
 * Activate the editor tracker plugin.
 */
function activate(app: QuantLab, editorServices: IEditorServices, browserFactory: IFileBrowserFactory, restorer: ILayoutRestorer, settingRegistry: ISettingRegistry, launcher: ILauncher | null, menu: IMainMenu | null): IEditorTracker {
  const id = plugin.id;
  const namespace = 'editor';
  const factory = new FileEditorFactory({
    editorServices,
    factoryOptions: { name: FACTORY, fileTypes: ['*'], defaultFor: ['*'] }
  });
  const { commands, restored } = app;
  const tracker = new InstanceTracker<FileEditor>({ namespace });
  const isEnabled = () => tracker.currentWidget !== null &&
                          tracker.currentWidget === app.shell.currentWidget;

  let {
    lineNumbers, lineWrap, matchBrackets, autoClosingBrackets
  } = CodeEditor.defaultConfig;

  // Handle state restoration.
  restorer.restore(tracker, {
    command: 'docmanager:open',
    args: widget => ({ path: widget.context.path, factory: FACTORY }),
    name: widget => widget.context.path
  });

  /**
   * Update the setting values.
   */
  function updateSettings(settings: ISettingRegistry.ISettings): void {
    let cached = settings.get('lineNumbers').composite as boolean | null;
    lineNumbers = cached === null ? lineNumbers : !!cached;
    cached = settings.get('matchBrackets').composite as boolean | null;
    matchBrackets = cached === null ? matchBrackets : !!cached;
    cached = settings.get('autoClosingBrackets').composite as boolean | null;
    autoClosingBrackets = cached === null ? autoClosingBrackets : !!cached;
    cached = settings.get('lineWrap').composite as boolean | null;
    lineWrap = cached === null ? lineWrap : !!cached;
  }

  /**
   * Update the settings of the current tracker instances.
   */
  function updateTracker(): void {
    tracker.forEach(widget => { updateWidget(widget); });
  }

  /**
   * Update the settings of a widget.
   */
  function updateWidget(widget: FileEditor): void {
    const editor = widget.editor;
    editor.setOption('lineNumbers', lineNumbers);
    editor.setOption('lineWrap', lineWrap);
    editor.setOption('matchBrackets', matchBrackets);
    editor.setOption('autoClosingBrackets', autoClosingBrackets);
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

  factory.widgetCreated.connect((sender, widget) => {
    widget.title.icon = EDITOR_ICON_CLASS;

    // Notify the instance tracker if restore data needs to update.
    widget.context.pathChanged.connect(() => { tracker.save(widget); });
    tracker.add(widget);
    updateWidget(widget);
  });
  app.docRegistry.addWidgetFactory(factory);

  // Handle the settings of new widgets.
  tracker.widgetAdded.connect((sender, widget) => {
    updateWidget(widget);
  });

  commands.addCommand(CommandIDs.lineNumbers, {
    execute: () => {
      const key = 'lineNumbers';
      const value = lineNumbers = !lineNumbers;

      updateTracker();
      return settingRegistry.set(id, key, value).catch((reason: Error) => {
        console.error(`Failed to set ${id}:${key} - ${reason.message}`);
      });
    },
    isEnabled,
    isToggled: () => lineNumbers,
    label: 'Line Numbers'
  });

  commands.addCommand(CommandIDs.lineWrap, {
    execute: () => {
      const key = 'lineWrap';
      const value = lineWrap = !lineWrap;

      updateTracker();
      return settingRegistry.set(id, key, value).catch((reason: Error) => {
        console.error(`Failed to set ${id}:${key} - ${reason.message}`);
      });
    },
    isEnabled,
    isToggled: () => lineWrap,
    label: 'Word Wrap'
  });

  commands.addCommand(CommandIDs.changeTabs, {
    label: args => args['name'] as string,
    execute: args => {
      let widget = tracker.currentWidget;
      if (!widget) {
        return;
      }
      let editor = widget.editor;
      let size = args['size'] as number || 4;
      let insertSpaces = !!args['insertSpaces'];
      editor.setOption('insertSpaces', insertSpaces);
      editor.setOption('tabSize', size);
    },
    isEnabled,
    isToggled: args => {
      let widget = tracker.currentWidget;
      if (!widget) {
        return false;
      }
      let insertSpaces = !!args['insertSpaces'];
      let size = args['size'] as number || 4;
      let editor = widget.editor;
      if (editor.getOption('insertSpaces') !== insertSpaces) {
        return false;
      }
      return editor.getOption('tabSize') === size;
    }
  });

  commands.addCommand(CommandIDs.matchBrackets, {
    execute: () => {
      matchBrackets = !matchBrackets;
      tracker.forEach(widget => {
        widget.editor.setOption('matchBrackets', matchBrackets);
      });
      return settingRegistry.set(id, 'matchBrackets', matchBrackets);
    },
    label: 'Match Brackets',
    isEnabled,
    isToggled: () => matchBrackets
  });

  commands.addCommand(CommandIDs.autoClosingBrackets, {
    execute: () => {
      autoClosingBrackets = !autoClosingBrackets;
      tracker.forEach(widget => {
        widget.editor.setOption('autoClosingBrackets', autoClosingBrackets);
      });
      return settingRegistry
        .set(id, 'autoClosingBrackets', autoClosingBrackets);
    },
    label: 'Auto-Closing Brackets',
    isEnabled,
    isToggled: () => autoClosingBrackets
  });

  commands.addCommand(CommandIDs.createConsole, {
    execute: args => {
      const widget = tracker.currentWidget;

      if (!widget) {
        return;
      }

      return commands.execute('console:create', {
        activate: args['activate'],
        path: widget.context.path,
        preferredLanguage: widget.context.model.defaultKernelLanguage
      });
    },
    isEnabled,
    label: 'Create Console for Editor'
  });

  commands.addCommand(CommandIDs.runCode, {
    execute: () => {
      // Run the appropriate code, taking into account a ```fenced``` code block.
      const widget = tracker.currentWidget;

      if (!widget) {
        return;
      }

      let code = '';
      const editor = widget.editor;
      const path = widget.context.path;
      const extension = PathExt.extname(path);
      const selection = editor.getSelection();
      const { start, end } = selection;
      let selected = start.column !== end.column || start.line !== end.line;

      if (selected) {
        // Get the selected code from the editor.
        const start = editor.getOffsetAt(selection.start);
        const end = editor.getOffsetAt(selection.end);

        code = editor.model.value.text.substring(start, end);
      } else if (MarkdownCodeBlocks.isMarkdown(extension)) {
        const { text } = editor.model.value;
        const blocks = MarkdownCodeBlocks.findMarkdownCodeBlocks(text);

        for (let block of blocks) {
          if (block.startLine <= start.line && start.line <= block.endLine) {
            code = block.code;
            selected = true;
            break;
          }
        }
      }

      if (!selected) {
        // no selection, submit whole line and advance
        code = editor.getLine(selection.start.line);
        const cursor = editor.getCursorPosition();
        if (cursor.line + 1 === editor.lineCount) {
          let text = editor.model.value.text;
          editor.model.value.text = text + '\n';
        }
        editor.setCursorPosition({ line: cursor.line + 1, column: cursor.column });
      }

      const activate = false;
      if (code) {
        return commands.execute('console:inject', { activate, code, path });
      } else {
        return Promise.resolve(void 0);
      }
    },
    isEnabled,
    label: 'Run Code'
  });

  commands.addCommand(CommandIDs.markdownPreview, {
    execute: () => {
      let widget = tracker.currentWidget;
      if (!widget) {
        return;
      }
      let path = widget.context.path;
      return commands.execute('markdownviewer:open', { path });
    },
    isVisible: () => {
      let widget = tracker.currentWidget;
      return widget && PathExt.extname(widget.context.path) === '.md' || false;
    },
    label: 'Show Markdown Preview'
  });

  // Function to create a new untitled text file, given
  // the current working directory.
  const createNew = (cwd: string) => {
    return commands.execute('docmanager:new-untitled', {
      path: cwd, type: 'file'
    }).then(model => {
      return commands.execute('docmanager:open', {
        path: model.path, factory: FACTORY
      });
    });
  }

  // Add a command for creating a new text file.
  commands.addCommand(CommandIDs.createNew, {
    label: 'Text File',
    caption: 'Create a new text file',
    execute: () => {
      let cwd = browserFactory.defaultBrowser.model.path;
      return createNew(cwd);
    }
  });

  // Add a launcher item if the launcher is available.
  if (launcher) {
    launcher.add({
      displayName: 'Text Editor',
      category: 'Other',
      rank: 1,
      iconClass: EDITOR_ICON_CLASS,
      callback: createNew
    });
  }

  if (menu) {
    // Add new text file creation to the file menu.
    menu.fileMenu.newMenu.addItem({ command: CommandIDs.createNew });

    // Add undo/redo hooks to the edit menu.
    menu.editMenu.undoers.add({
      tracker,
      undo: widget => { widget.editor.undo(); },
      redo: widget => { widget.editor.redo(); }
    } as IEditMenu.IUndoer<FileEditor>);

    // Add editor view options.
    menu.viewMenu.editorViewers.add({
      tracker,
      toggleLineNumbers: widget => {
        const lineNumbers = !widget.editor.getOption('lineNumbers');
        widget.editor.setOption('lineNumbers', lineNumbers);
      },
      toggleWordWrap: widget => {
        const wordWrap = !widget.editor.getOption('lineWrap');
        widget.editor.setOption('lineWrap', wordWrap);
      },
      toggleMatchBrackets: widget => {
        const matchBrackets = !widget.editor.getOption('matchBrackets');
        widget.editor.setOption('matchBrackets', matchBrackets);
      },
      lineNumbersToggled: widget => widget.editor.getOption('lineNumbers'),
      wordWrapToggled: widget => widget.editor.getOption('lineWrap'),
      matchBracketsToggled: widget => widget.editor.getOption('matchBrackets')
    } as IViewMenu.IEditorViewer<FileEditor>);

    // Add a console creator the the Kernel menu.
    menu.kernelMenu.consoleCreators.add({
      tracker,
      createConsole: current => {
        const options = {
          path: current.context.path,
          preferredLanguage: current.context.model.defaultKernelLanguage
        };
        return commands.execute('console:create', options);
      }
    } as IKernelMenu.IConsoleCreator<FileEditor>);

    // Add a code runner to the Run menu.
    menu.runMenu.codeRunners.add({
      tracker,
      noun: 'Code',
      pluralNoun: 'Code',
      run: () => commands.execute(CommandIDs.runCode)
    });
  }

  app.contextMenu.addItem({
    command: CommandIDs.createConsole, selector: '.jp-FileEditor'
  });
  app.contextMenu.addItem({
    command: CommandIDs.markdownPreview, selector: '.jp-FileEditor'
  });

  return tracker;
}
