// Copyright (c) QuantLab Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Kernel, KernelMessage
} from '@quantlab/services';

import {
  PromiseDelegate, Token
} from '@phosphor/coreutils';

import {
  Message
} from '@phosphor/messaging';

import {
  ISignal, Signal
} from '@phosphor/signaling';

import {
  PanelLayout, Widget
} from '@phosphor/widgets';

import {
  IClientSession, Toolbar
} from '@quantlab/apputils';

import {
  IChangedArgs
} from '@quantlab/coreutils';

import {
  DocumentRegistry
} from '@quantlab/docregistry';

import {
  Spreadsheet
} from './widget';

import {
  ISpreadsheetModel
} from './model';

import * as $ from 'jquery';

import QuantLibXL from './formulas';

/**
 * The class name added to spreadsheet panels.
 */
const SPREADSHEET_PANEL_CLASS = 'jp-SpreadsheetPanel';

const SPREADSHEET_TOOLBAR_CLASS = 'jp-Spreadsheet-toolbar';

const SPREADSHEET_CLASS = 'jp-Spreadsheet';

/**
 * The class name added to a dirty widget.
 */
const DIRTY_CLASS = 'jp-mod-dirty';


/**
 * A widget that hosts a spreadsheet toolbar and content area.
 *
 * #### Notes
 * The widget keeps the document metadata in sync with the current
 * kernel on the context.
 */
export
class SpreadsheetPanel extends Widget implements DocumentRegistry.IReadyWidget {
  /**
   * Construct a new spreadsheet panel.
   */
  constructor(options: SpreadsheetPanel.IOptions) {
    super();
    this.addClass(SPREADSHEET_PANEL_CLASS);

    let contentFactory = this.contentFactory = (
      options.contentFactory || SpreadsheetPanel.defaultContentFactory
    );

    let layout = this.layout = new PanelLayout();

    // Toolbar
    let toolbar = new Toolbar();
    toolbar.addClass(SPREADSHEET_TOOLBAR_CLASS);

    // spreadsheet
    let ssOptions = {
      languagePreference: options.languagePreference,
      contentFactory: contentFactory
    };
    let spreadsheet = this.spreadsheet = contentFactory.createSpreadsheet(ssOptions);
    spreadsheet.addClass(SPREADSHEET_CLASS);

    layout.addWidget(toolbar);
    layout.addWidget(this.spreadsheet);
  }

  /**
   * A signal emitted when the panel has been activated.
   */
  get activated(): ISignal<this, void> {
    return this._activated;
  }

  /**
   * A signal emitted when the panel context changes.
   */
  get contextChanged(): ISignal<this, void> {
    return this._contextChanged;
  }

  /**
   * The client session used by the panel.
   */
  get session(): IClientSession {
    return this._context ? this._context.session : null;
  }

  /**
   * A promise that resolves when the spreadsheet panel is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  /**
   * The factory used by the widget.
   */
  readonly contentFactory: SpreadsheetPanel.IContentFactory;

  /**
   * The spreadsheet used by the widget.
   */
  readonly spreadsheet: Spreadsheet;

  /**
   * Get the toolbar used by the widget.
   */
  get toolbar(): Toolbar<Widget> {
    return (this.layout as PanelLayout).widgets[0] as Toolbar<Widget>;
  }

  /**
   * The model for the widget.
   */
  get model(): ISpreadsheetModel {
    return this.spreadsheet ? this.spreadsheet.model : null;
  }

  /**
   * The document context for the widget.
   *
   * #### Notes
   * Changing the context also changes the model on the
   * `content`.
   */
  get context(): DocumentRegistry.IContext<ISpreadsheetModel> {
    return this._context;
  }
  set context(newValue: DocumentRegistry.IContext<ISpreadsheetModel>) {
    newValue = newValue || null;
    if (newValue === this._context) {
      return;
    }
    let oldValue = this._context;
    this._context = newValue;
    // Trigger private, protected, and public changes.
    this._onContextChanged(oldValue, newValue);
    this.onContextChanged(oldValue, newValue);
    this._contextChanged.emit(void 0);

    if (!oldValue) {
      newValue.ready.then(() => {

        this._ready.resolve(undefined);
      });
    }

  }

  /**
   * Dispose of the resources used by the widget.
   */
  dispose(): void {
    this._context = null;
    this.spreadsheet.dispose();
    super.dispose();
  }

  /**
   * Handle the DOM events for the widget.
   *
   * @param event - The DOM event sent to the widget.
   *
   * #### Notes
   * This method implements the DOM `EventListener` interface and is
   * called in response to events on the dock panel's node. It should
   * not be called directly by user code.
   */
  handleEvent(event: Event): void {
    switch (event.type) {
    case 'mouseup':
    case 'mouseout':
      let target = event.target as HTMLElement;
      if (this.toolbar.node.contains(document.activeElement) &&
          target.localName !== 'select') {
        this.spreadsheet.node.focus();
      }
      break;
    default:
      break;
    }
  }

  /**
   * Handle `after-attach` messages for the widget.
   */
  protected onAfterAttach(msg: Message): void {
    this.toolbar.node.addEventListener('mouseup', this);
    this.toolbar.node.addEventListener('mouseout', this);
  }

  /**
   * Handle `before-detach` messages for the widget.
   */
  protected onBeforeDetach(msg: Message): void {
    this.toolbar.node.removeEventListener('mouseup', this);
    this.toolbar.node.removeEventListener('mouseout', this);
  }

  /**
   * Handle `'activate-request'` messages.
   */
  protected onActivateRequest(msg: Message): void {
    this.spreadsheet.activate();
    this._activated.emit(void 0);
  }

  /**
   * Handle a change to the document context.
   *
   * #### Notes
   * The default implementation is a no-op.
   */
  protected onContextChanged(oldValue: DocumentRegistry.IContext<ISpreadsheetModel>, newValue: DocumentRegistry.IContext<ISpreadsheetModel>): void {
    // This is a no-op.
  }


  /**
   * Handle a change in the model state.
   */
  protected onModelStateChanged(sender: ISpreadsheetModel, args: IChangedArgs<any>): void {
    if (args.name === 'dirty') {
      this._handleDirtyState();
    }
  }

  /**
   * Handle a change to the document path.
   */
  protected onPathChanged(sender: DocumentRegistry.IContext<ISpreadsheetModel>, path: string): void {
    this.title.label = path.split('/').pop();
  }

  /**
   * Handle a change in the context.
   */
  private _onContextChanged(oldValue: DocumentRegistry.IContext<ISpreadsheetModel>, newValue: DocumentRegistry.IContext<ISpreadsheetModel>): void {
    if (oldValue) {
      oldValue.pathChanged.disconnect(this.onPathChanged, this);
      oldValue.session.kernelChanged.disconnect(this._onKernelChanged, this);
      if (oldValue.model) {
        oldValue.model.stateChanged.disconnect(this.onModelStateChanged, this);
      }
    }
    if (!newValue) {
      this._onKernelChanged(null, null);
      return;
    }
    let context = newValue;
    this.spreadsheet.model = newValue.model;
    this._handleDirtyState();
    newValue.model.stateChanged.connect(this.onModelStateChanged, this);
    context.session.kernelChanged.connect(this._onKernelChanged, this);

    // Clear the cells when the context is initially populated.
    if (!newValue.isReady) {
      newValue.ready.then(() => {
        if (this.isDisposed) {
          return;
        }

        // toolbar color pick
        const colors = [
          ["#000","#444","#666","#999","#ccc","#eee","#f3f3f3","#fff"],
          ["#f00","#f90","#ff0","#0f0","#0ff","#00f","#90f","#f0f"],
          ["#f4cccc","#fce5cd","#fff2cc","#d9ead3","#d0e0e3","#cfe2f3","#d9d2e9","#ead1dc"],
          ["#ea9999","#f9cb9c","#ffe599","#b6d7a8","#a2c4c9","#9fc5e8","#b4a7d6","#d5a6bd"],
          ["#e06666","#f6b26b","#ffd966","#93c47d","#76a5af","#6fa8dc","#8e7cc3","#c27ba0"],
          ["#c00","#e69138","#f1c232","#6aa84f","#45818e","#3d85c6","#674ea7","#a64d79"],
          ["#900","#b45f06","#bf9000","#38761d","#134f5c","#0b5394","#351c75","#741b47"],
          ["#600","#783f04","#7f6000","#274e13","#0c343d","#073763","#20124d","#4c1130"]
        ];

        $('#'+this.id).first().find('input:first-of-type').spectrum({
            showPaletteOnly: true,
            showPalette:true,
            allowEmpty:true,
            hideAfterPaletteSelect:true,
            color: '#fff',
            palette: colors,
            change: ( (color:any) => {
              this.spreadsheet.style('background', color.toHexString())
            })
        });
        $('#'+this.id).first().find('input:nth-of-type(2)').spectrum({
            showPaletteOnly: true,
            showPalette:true,
            allowEmpty:true,
            hideAfterPaletteSelect:true,
            color: '#000',
            palette: colors,
            change: ( (color:any) => {
              this.spreadsheet.style('color', color.toHexString())
            })
        });

        this.spreadsheet.createSheet();
        let parent = this;

        QuantLibXL.forEach( func => {

          this.spreadsheet.createFormula('QL'+func.toUpperCase(), (args:any) => {
              // the argument could be future from previous kernel execution
              if(args[0] && (typeof args[0].done == 'object')){
                //TODO
              }else{
                let code: string[] = parent.handleArgs(args);

                code.push('var result = ql.' + func + '.apply(undefined,args);');
                code.push("if(result[0].indexOf('object with that ID already exists')!== -1){");
                code.push("  result = ['', args[0]]");
                code.push('}');
                code.push('result');
                //console.log(code.join('\n'));

                return parent.execute(code.join('\n'));
              }

          });

        })

        //this.spreadsheet.recalculate();


        //let model = newValue.model;
        // Clear the undo state of the cells.
        /*
        if (model) {
          model.cells.clearUndo();
          each(this.spreadsheet.widgets, widget => {
            widget.editor.clearHistory();
          });
        }
        */
      });
    }

    // Handle the document title.
    this.onPathChanged(context, context.path);
    context.pathChanged.connect(this.onPathChanged, this);
  }

  handleArgs(args:any[]):string[] {
    let code: string[] = [];
    code.push('var args = [];')

    args.forEach( s => {
      if(Array.isArray(s)){
        var tmpArray = '[';
        s.forEach( a => {
          if(Array.isArray(a)){
            var tmpMatrix = '[';
            a.forEach( m => {
              // tensor = matrix
              if(Object.prototype.toString.call(m) === '[object Number]' || Object.prototype.toString.call(m) === '[object Boolean]')
                tmpMatrix += m + ',';
              else
                tmpMatrix += '"' + m + '",';
            })
            tmpMatrix = tmpMatrix.slice(0,-1);
            tmpMatrix += ']';
            tmpArray += tmpMatrix + ',';
          }else{
            if(Object.prototype.toString.call(a) === '[object Number]' || Object.prototype.toString.call(a) === '[object Boolean]')
              tmpArray += a + ',';
            else
              tmpArray += '"' +a + '",';
          }
        })
        // tensor = array
        tmpArray = tmpArray.slice(0,-1);
        tmpArray += ']';
        code.push('args.push(' + tmpArray + ');')
      }else{ // tensor = single
        if(Object.prototype.toString.call(s) === '[object Number]' || Object.prototype.toString.call(s) === '[object Boolean]')
        code.push('args.push(' + s + ');')
        else
          code.push('args.push("' + s + '");')
      }
    });

    return code;
  }

  execute(code:string): Kernel.IFuture {
      let content: KernelMessage.IExecuteRequest = {
        code,
        stop_on_error: true
      };

      if (!this.session.kernel) {
        throw Error('NO_KERNEL');
      }

      let future = this.session.kernel.requestExecute(content, false);
      return future;
  }

  /**
   * Handle a change in the kernel by updating the document metadata.
   */
  private _onKernelChanged(sender: any, kernel: Kernel.IKernelConnection): void {
    if (!this.model || !kernel) {
      return;
    }
    //let parent = this;
    kernel.ready.then(() => {
      if (this.model) {
        this._updateLanguage(kernel.info.language_info);
      }
      if(kernel.info.language_info.name == 'javascript'){
        this.execute('const ql = require("quantlibxl");').done.then( msg => {
          //parent.spreadsheet.recalculate();
        });
      }
    });
    this._updateSpec(kernel);
  }

  /**
   * Update the kernel language.
   */
  private _updateLanguage(language: KernelMessage.ILanguageInfo): void {
    //this.model.metadata.set('language_info', language);
  }

  /**
   * Update the kernel spec.
   */
  private _updateSpec(kernel: Kernel.IKernelConnection): void {
    kernel.getSpec().then(spec => {
      if (this.isDisposed) {
        return;
      }
      //this.model.metadata.set('kernelspec', {
      //  name: kernel.name,
      //  display_name: spec.display_name,
      //  language: spec.language
      //});
    });
  }

  /**
   * Handle the dirty state of the model.
   */
  private _handleDirtyState(): void {
    if (!this.model) {
      return;
    }
    if (this.model.dirty) {
      this.title.className += ` ${DIRTY_CLASS}`;
    } else {
      this.title.className = this.title.className.replace(DIRTY_CLASS, '');
    }
  }

  private _context: DocumentRegistry.IContext<ISpreadsheetModel> = null;
  private _activated = new Signal<this, void>(this);
  private _contextChanged = new Signal<this, void>(this);
  private _ready = new PromiseDelegate<void>();
}


/**
 * A namespace for `SpreadsheetPanel` statics.
 */
export namespace SpreadsheetPanel {
  /**
   * An options interface for SpreadsheetPanels.
   */
  export
  interface IOptions {
    /**
     * The language preference for the model.
     */
    languagePreference?: string;

    /**
     * The content factory for the panel.
     */
    contentFactory?: IContentFactory;

  }

  /**
   * A content factory interface for SpreadsheetPanels.
   */
  export
  interface IContentFactory {
    /**
     * Create a new content area for the panel.
     */
    createSpreadsheet(options: Spreadsheet.IOptions): Spreadsheet;

  }

  /**
   * The default implementation of an `IContentFactory`.
   */
  export
  class ContentFactory implements IContentFactory {
    /**
     * Create a new content area for the panel.
     */
    createSpreadsheet(options: Spreadsheet.IOptions): Spreadsheet {
      return new Spreadsheet(options);
    }
  }

  /**
   * Default content factory for the spreadsheet panel.
   */
  export
  const defaultContentFactory: ContentFactory = new ContentFactory();

  /* tslint:disable */
  /**
   * The spreadsheet renderer token.
   */
  export
  const IContentFactory = new Token<IContentFactory>('jupyter.services.spreadsheet.content-factory');
  /* tslint:enable */
}
