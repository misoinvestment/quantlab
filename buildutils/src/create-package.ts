/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as inquirer from 'inquirer';
import * as path from 'path';
import * as utils from './utils';

let questions = [
  {
    type: 'input',
    name: 'name',
    message: 'name: '
  },
  {
    type: 'input',
    name: 'description',
    message: 'description: ',
  }
];

inquirer.prompt(questions).then(answers => {
  let { name, description } = answers;
  let dest = path.resolve(path.join('.', 'packages', name));
  if (fs.existsSync(dest)) {
    console.error('Package already exists: ', name);
    process.exit(1);
  }
  fs.copySync(path.resolve(path.join(__dirname, '..', 'template')), dest);
  let jsonPath = path.join(dest, 'package.json');
  let data = utils.readJSONFile(jsonPath);
  if (name.indexOf('@quantlab/') === -1) {
    name = '@quantlab/' + name;
  }
  data.name = name;
  data.description = description;
  utils.writePackageData(jsonPath, data);
  utils.run('qlpm run integrity');
});
