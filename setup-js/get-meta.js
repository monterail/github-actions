const crypto = require('crypto');
const fs = require('fs');

/**
 * @typedef {{
 *  core: import('@actions/core'),
 *  github: import('@actions/github'),
 *  inputs: Record<string, string>,
 *  runsOn: string,
 * }} RootContext */

module.exports = function run(
  /** @type {RootContext} */
  { core, github, inputs, runsOn }) {
  if (!fs.existsSync('package.json')) {
    core.setFailed('No package.json found in current directory');
  }

  const packageJson = JSON.parse(
    fs.readFileSync('package.json').toString(),
  );

  const packageManager = inputs['package-manager'].toLowerCase();

  const isYarn = packageManager === 'yarn';

  const installCommand =
    inputs['install-command'] ||
    (isYarn ? 'yarn install' : 'npm i');

  const getCacheDirCommand = isYarn ? 'yarn cache dir' : 'npm config get cache'

  const lockfile = isYarn ?
    'yarn.lock' : 'package-lock.json';

  const hashStrategy =
    inputs['hash-strategy'] ||
    (fs.existsSync(lockfile) ? 'lockfile' : 'dependencies');

  const dependenciesArray = Object.entries({
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
    ...(packageJson.peerDependencies ?? {}),
    ...(packageJson.optionalDependencies ?? {}),
    ...(packageJson.bundlesDependencies ?? {}),
  });

  const hash = crypto.createHash('sha256');

  const dependenciesHash = hash
    .update(
      dependenciesArray
        .map(([name, version]) => `${name}@${version}`)
        .sort()
        .join('\n'),
    )
    .digest('base64');

  const nodeModulesCachePrefix = [
    inputs['cache-prefix'],
    runsOn,
    inputs['node-version'].replace(/[/.]/g, '-'),
    packageManager,
  ].join('-');

  const outputs = {
    'dependencies-hash': dependenciesHash,
    'get-cache-dir-command': getCacheDirCommand,
    'hash-strategy': hashStrategy,
    'install-command': installCommand,
    'lockfile': lockfile,
    'node-modules-cache-prefix': nodeModulesCachePrefix,
    'package-manager': packageManager,
  };

  console.log('--- setup-js metadata ---');
  console.log(outputs);

  Object.entries(outputs).forEach(([name, value]) => {
    core.setOutput(name, value);
  });
}
