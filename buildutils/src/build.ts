/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as path from 'path';

/**
 *  A namespace for QuantLab build utilities.
 */
export
namespace Build {
  /**
   * The options used to ensure a root package has the appropriate
   * assets for its QuantLab extension packages.
   */
  export
  interface IEnsureOptions {
    /**
     * The output directory where the build assets should reside.
     */
    output: string;

    /**
     * The names of the packages to ensure.
     */
    packageNames: ReadonlyArray<string>;
  }

  /**
   * The QuantLab extension attributes in a module.
   */
  export
  interface ILabExtension {
    /**
     * Indicates whether the extension is a standalone extension.
     *
     * #### Notes
     * If `true`, the `main` export of the package is used. If set to a string
     * path, the export from that path is loaded as a QuantLab extension. It
     * is possible for one package to have both an `extension` and a
     * `mimeExtension` but they cannot be identical (i.e., the same export
     * cannot be declared both an `extension` and a `mimeExtension`).
     */
    readonly extension?: boolean | string;

    /**
     * Indicates whether the extension is a MIME renderer extension.
     *
     * #### Notes
     * If `true`, the `main` export of the package is used. If set to a string
     * path, the export from that path is loaded as a QuantLab extension. It
     * is possible for one package to have both an `extension` and a
     * `mimeExtension` but they cannot be identical (i.e., the same export
     * cannot be declared both an `extension` and a `mimeExtension`).
     */
    readonly mimeExtension?: boolean | string;

    /**
     * The local schema file path in the extension package.
     */
    readonly schemaDir?: string;

    /**
     * The local theme file path in the extension package.
     */
    readonly themeDir?: string;
  }

  /**
   * A minimal definition of a module's package definition (i.e., package.json).
   */
  export
  interface IModule {
    /**
     * The QuantLab metadata/
     */
    quantlab?: ILabExtension;

    /**
     * The main entry point in a module.
     */
    main?: string;

    /**
     * The name of a module.
     */
    name: string;
  }

  /**
   * Ensures that the assets of plugin packages are populated for a build.
   */
  export
  function ensureAssets(options: IEnsureOptions): void {
    let { output, packageNames } = options;

    packageNames.forEach(function(name) {
      const packageDataPath = require.resolve(path.join(name, 'package.json'));
      const packageDir = path.dirname(packageDataPath);
      const packageData = require(packageDataPath);
      const extension = normalizeExtension(packageData);
      const { schemaDir, themeDir } = extension;

      // Handle schemas.
      if (schemaDir) {
        const schemas = glob.sync(path.join(path.join(packageDir, schemaDir), '*'));
        const destination = path.join(output, 'schemas', name);

        // Remove the existing directory if necessary.
        if (fs.existsSync(destination)) {
          try {
            const oldPackageData = require(path.join(destination, 'package.json'));
            if (oldPackageData.version === packageData.version) {
              fs.removeSync(destination);
            }
          } catch (e) {
            fs.removeSync(destination);
          }
        }

        // Make sure the schema directory exists.
        fs.mkdirpSync(destination);

        // Copy schemas.
        schemas.forEach(schema => {
          const file = path.basename(schema);
          if (file === 'package.json') {
            throw new Error('Cannot use name "package.json" for schema file');
          }
          fs.copySync(schema, path.join(destination, file));
        });

        // Write the package.json file for future comparison.
        fs.copySync(path.join(packageDir, 'package.json'), path.join(destination, 'package.json'));
      }

      // Handle themes.
      if (themeDir) {
        const from = path.join(packageDir, themeDir);
        const destination = path.join(output, 'themes', name);

        // Remove the existing directory if necessary.
        if (fs.existsSync(destination)) {
          try {
            const oldPackageData = require(path.join(destination, 'package.json'));
            if (oldPackageData.version === packageData.version) {
              fs.removeSync(destination);
            }
          } catch (e) {
            fs.removeSync(destination);
          }
        }

        // Make sure the theme directory exists.
        fs.mkdirpSync(destination);

        // Copy the theme folder.
        fs.copySync(from, destination);

        // Write the package.json file for future comparison.
        fs.copySync(path.join(packageDir, 'package.json'), path.join(destination, 'package.json'));
      }
    });
  }

  /**
   * Returns QuantLab extension metadata from a module.
   */
  export
  function normalizeExtension(module: IModule): ILabExtension {
    let { quantlab, main, name } = module;

    main = main || 'index.js';

    if (!quantlab) {
      throw new Error(`Module ${name} does not contain QuantLab metadata.`);
    }

    let { extension, mimeExtension, schemaDir, themeDir } = quantlab;

    extension = extension === true ? main : extension;
    mimeExtension = mimeExtension === true ? main : mimeExtension;

    if (extension && mimeExtension && extension === mimeExtension) {
      const message = 'extension and mimeExtension cannot be the same export.';

      throw new Error(message);
    }

    return { extension, mimeExtension, schemaDir, themeDir };
  }
}
