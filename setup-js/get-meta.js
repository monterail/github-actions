const crypto = require('crypto');
const fs = require('fs');

/**
 *
 * @typedef {{
 *  'cache-prefix'?: string;
 *  'hash-strategy'?: string;
 *  'install-args'?: string;
 *  'install-command'?: string;
 *  'node-version'?: string;
 *  'package-manager'?: string;
 *  'working-directory'?: string;
 * }} Inputs
 *
 * @typedef {{
 *  core: import('@actions/core'),
 *  github: import('@actions/github'),
 *  inputs: Inputs,
 *  runsOn: string,
 * }} RootContext */

module.exports = function run(
  /** @type {RootContext} */
  { core, github, inputs, runsOn }) {
  const workingDirectory = inputs['working-directory']

  if (typeof workingDirectory === 'string') {
    process.chdir(workingDirectory)
  }

  if (!fs.existsSync('package.json')) {
    core.setFailed('No package.json found in current directory');
    return
  }

  /** @type {import('type-fest').PackageJson} */
  const packageJson = JSON.parse(
    fs.readFileSync('package.json').toString(),
  );

  /** @type {string} */
  const packageManager = (inputs['package-manager'] || 'npm').toLowerCase();

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
    ...(packageJson.bundledDependencies ?? {}),
  });

  const dependenciesHash = crypto.createHash('sha256')
    .update(
      dependenciesArray
        .map(([name, version]) => `${name}@${version}`)
        .sort()
        .join('\n'),
    )
    .digest('hex');

  const workingDirectoryHash = crypto.createHash('sha256')
    .update(inputs['working-directory'] || '.')
    .digest('hex')
    .slice(0, 7)

  const nodeModulesCachePrefix = [
    inputs['cache-prefix'],
    runsOn,
    (inputs['node-version'] || 'lts/gallium').replace(/[/.]/g, '-'),
    packageManager,
    workingDirectoryHash,
  ].join('-');

  const outputs = {
    'dependencies-hash': dependenciesHash,
    'get-cache-dir-command': getCacheDirCommand,
    'hash-strategy': hashStrategy,
    'install-command': installCommand,
    'lockfile': lockfile,
    'node-modules-cache-prefix': nodeModulesCachePrefix,
    'package-manager': packageManager,
    'working-directory-hash': workingDirectoryHash,
  };

  Object.entries(outputs).forEach(([name, value]) => {
    core.setOutput(name, value);
  });

  // Log for debugging purposes.
  console.log(outputs);
}
