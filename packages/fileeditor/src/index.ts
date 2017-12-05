// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
import {
  IInstanceTracker
} from '@quantlab/apputils';

import {
 Token
} from '@phosphor/coreutils';

import {
  FileEditor
} from './widget';

import '../style/index.css';

export * from './widget';


/**
 * A class that tracks editor widgets.
 */
export
interface IEditorTracker extends IInstanceTracker<FileEditor> {}


/* tslint:disable */
/**
 * The editor tracker token.
 */
export
const IEditorTracker = new Token<IEditorTracker>('@quantlab/fileeditor:IEditorTracker');
/* tslint:enable */
