// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
import {
  ILayoutRestorer, QuantLab, QuantLabPlugin
} from '@quantlab/application';

import {
  InstanceTracker
} from '@quantlab/apputils';

import {
  CSVViewer, CSVViewerFactory
} from '@quantlab/csvviewer';


/**
 * The name of the factory that creates CSV widgets.
 */
const FACTORY = 'Table';


/**
 * The table file handler extension.
 */
const plugin: QuantLabPlugin<void> = {
  activate,
  id: '@quantlab/csvviewer-extension:plugin',
  requires: [ILayoutRestorer],
  autoStart: true
};


/**
 * Export the plugin as default.
 */
export default plugin;


/**
 * Activate the table widget extension.
 */
function activate(app: QuantLab, restorer: ILayoutRestorer): void {
  const factory = new CSVViewerFactory({
    name: FACTORY,
    fileTypes: ['csv'],
    defaultFor: ['csv'],
    readOnly: true
  });
  const tracker = new InstanceTracker<CSVViewer>({ namespace: 'csvviewer' });

  // Handle state restoration.
  restorer.restore(tracker, {
    command: 'docmanager:open',
    args: widget => ({ path: widget.context.path, factory: FACTORY }),
    name: widget => widget.context.path
  });

  app.docRegistry.addWidgetFactory(factory);
  let ft = app.docRegistry.getFileType('csv');
  factory.widgetCreated.connect((sender, widget) => {
    // Track the widget.
    tracker.add(widget);
    // Notify the instance tracker if restore data needs to update.
    widget.context.pathChanged.connect(() => { tracker.save(widget); });

    if (ft) {
      widget.title.iconClass = ft.iconClass;
      widget.title.iconLabel = ft.iconLabel;
    }
  });
}
