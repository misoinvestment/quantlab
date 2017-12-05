// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
import {
  ISettingRegistry, URLExt
} from '@quantlab/coreutils';

import {
  ServerConnection
} from '../serverconnection';


/**
 * The url for the quantlab settings service.
 */
const SERVICE_SETTINGS_URL = 'quantlab/api/settings';


/**
 * The static namespace for `SettingManager`.
 */
export
class SettingManager {
  /**
   * Create a new setting manager.
   */
  constructor(options: SettingManager.IOptions = { }) {
    this.serverSettings = options.serverSettings ||
      ServerConnection.makeSettings();
  }

  /**
   * The server settings used to make API requests.
   */
  readonly serverSettings: ServerConnection.ISettings;

  /**
   * Fetch a plugin's settings.
   *
   * @param id - The plugin's ID.
   *
   * @returns A promise that resolves with the plugin settings or rejects
   * with a `ServerConnection.IError`.
   */
  fetch(id: string): Promise<ISettingRegistry.IPlugin> {
    const base = this.serverSettings.baseUrl;
    const request = { method: 'GET', url: Private.url(base, id) };
    const { serverSettings } = this;
    const promise = ServerConnection.makeRequest(request, serverSettings);

    return promise.then(response => {
      const { status } = response.xhr;

      if (status !== 200) {
        throw ServerConnection.makeError(response);
      }

      return response.data;
    }).catch(reason => { throw ServerConnection.makeError(reason); });
  }

  /**
   * Save a plugin's settings.
   *
   * @param id - The plugin's ID.
   *
   * @param raw - The user setting values as a raw string of JSON with comments.
   *
   * @returns A promise that resolves when saving is complete or rejects
   * with a `ServerConnection.IError`.
   */
  save(id: string, raw: string): Promise<void> {
    const base = this.serverSettings.baseUrl;
    const request = {
      data: raw,
      contentType: 'text/javascript',
      method: 'PUT',
      url: Private.url(base, id)
    };
    const { serverSettings } = this;
    const promise = ServerConnection.makeRequest(request, serverSettings);

    return promise.then(response => {
      const { status } = response.xhr;

      if (status !== 204) {
        throw ServerConnection.makeError(response);
      }

      return void 0;
    }).catch(reason => { throw ServerConnection.makeError(reason); });
  }
}


/**
 * A namespace for `SettingManager` statics.
 */
export
namespace SettingManager {
  /**
   * The instantiation options for a setting manager.
   */
  export
  interface IOptions {
    /**
     * The server settings used to make API requests.
     */
    serverSettings?: ServerConnection.ISettings;
  }
}


/**
 * A namespace for setting API interfaces.
 */
export
namespace Setting {
  /**
   * The interface for the setting system manager.
   */
  export
  interface IManager extends SettingManager { }
}


/**
 * A namespace for private data.
 */
namespace Private {
  /**
   * Get the url for a plugin's settings.
   */
  export
  function url(base: string, id: string): string {
    return URLExt.join(base, SERVICE_SETTINGS_URL, id);
  }
}
