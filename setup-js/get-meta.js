const crypto = require('crypto');
const fs = require('fs');
const {dirname} = require('path');

function findGitRoot(
  /** @type {string} */
  pathname,
  /** @type {number} */
  remainingAttempts = 5
) {
  if (remainingAttempts === 0) {
    return null
  }

  if (fs.existsSync('.git')) {
    return pathname
  }

  return findGitRoot(
    dirname(pathname),
    remainingAttempts - 1,
  );
}

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

  if (!inputs['node-version']) {
    core.warning(`It is recommended to always set 'node-version'`);
  }

  const workingDirectory = inputs['working-directory']

  if (typeof workingDirectory === 'string') {
    process.chdir(workingDirectory)
  }

  if (!fs.existsSync('package.json')) {
    core.setFailed('No package.json found in current directory');
    return
  }

  const gitRoot = findGitRoot(__dirname);

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

  const versionCommand = (isYarn ? 'yarn -v' : 'npm -v');

  const getCacheDirCommand = isYarn ? 'yarn cache dir' : 'npm config get cache'

  const lockfile = isYarn ?
    'yarn.lock' : 'package-lock.json';

  const hashFiles = `**/${lockfile}`

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
    'git-root': gitRoot,
    'hash-files': hashFiles,
    'hash-strategy': hashStrategy,
    'install-command': installCommand,
    'lockfile': lockfile,
    'node-modules-cache-prefix': nodeModulesCachePrefix,
    'package-manager-version-command': versionCommand,
    'package-manager': packageManager,
    'working-directory-hash': workingDirectoryHash,
  };

  Object.entries(outputs).forEach(([name, value]) => {
    core.setOutput(name, value);
  });

  // Log for debugging purposes.
  console.log(outputs);
}
