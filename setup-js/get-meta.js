const crypto = require('crypto');
const fs = require('fs');
const { dirname, join } = require('path');

/**
 * @type {(pathname: string, remainingAttempts: number | undefined) => string | null}
 */
function findGitRoot(pathname, remainingAttempts = 5) {
  if (remainingAttempts === 0) {
    return null;
  }

  if (fs.existsSync(join(pathname, '.git'))) {
    return pathname;
  }

  return findGitRoot(dirname(pathname), remainingAttempts - 1);
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
 *  glob: import('@actions/glob'),
 *  inputs: Inputs,
 *  runsOn: string,
 * }} RootContext */

module.exports = async function run(
  /** @type {RootContext} */
  { core, glob, github, inputs, runsOn },
) {
  if (!inputs['node-version']) {
    core.warning(`It is recommended to always set 'node-version'`);
  }

  const workingDirectory = inputs['working-directory'];

  if (typeof workingDirectory === 'string') {
    process.chdir(workingDirectory);
  }

  if (!fs.existsSync('package.json')) {
    core.setFailed('No package.json found in current directory');
    return;
  }

  let isMonorepo = false;

  const gitRoot = findGitRoot(__dirname);

  if (!gitRoot) {
    core.setFailed('Failed to determine .git directory location');
    return;
  }

  try {
    /** @type {import('type-fest').PackageJson} */
    const gitRootPackageJson = JSON.parse(
      fs.readFileSync(join(gitRoot, 'package.json')).toString(),
    );

    isMonorepo =
      'workspaces' in gitRootPackageJson ||
      fs.existsSync(join(gitRoot, 'turbo.json')) ||
      fs.existsSync(join(gitRoot, 'nx.json'));
  } catch {
    // Ignore if there is no package.json in the root directory.
  }

  /** @type {string} */
  const packageManager = (inputs['package-manager'] || 'npm').toLowerCase();

  const isYarn = packageManager === 'yarn';

  const installCommand = inputs['install-command'] || (isYarn ? 'yarn install' : 'npm i');

  const versionCommand = isYarn ? 'yarn -v' : 'npm -v';

  const getCacheDirCommand = isYarn ? 'yarn cache dir' : 'npm config get cache';

  const lockfile = isYarn ? 'yarn.lock' : 'package-lock.json';

  const hashFiles = `**/${lockfile}`;

  const hashFilesPattern = join(gitRoot, hashFiles);

  const lockfilesHash = await glob.hashFiles(hashFilesPattern);

  const lockfileGlobber = await glob.create(join(gitRoot, hashFiles));
  const lockfiles = await lockfileGlobber.glob();

  const packageJsonGlobber = await glob.create(join(gitRoot, '**/package.json'));
  const packageJsonFiles = await packageJsonGlobber.glob();

  const hashStrategy =
    inputs['hash-strategy'] || (lockfiles.length > 0 ? 'lockfile' : 'dependencies');

  const dependenciesArray = [];

  for (const packageJsonFile of hashStrategy === 'dependencies' ? packageJsonFiles : []) {
    /** @type {import('type-fest').PackageJson} */
    const packageJson = JSON.parse(fs.readFileSync(packageJsonFile).toString());

    dependenciesArray.push(
      ...Object.entries({
        ...(packageJson.dependencies ?? {}),
        ...(packageJson.devDependencies ?? {}),
        ...(packageJson.peerDependencies ?? {}),
        ...(packageJson.optionalDependencies ?? {}),
        ...(packageJson.bundleDependencies ?? {}),
        ...(packageJson.bundledDependencies ?? {}),
      }),
    );
  }

  const dependenciesHash = crypto
    .createHash('sha256')
    .update(
      dependenciesArray
        .map(([name, version]) => `${name}@${version}`)
        .sort()
        .join('\n'),
    )
    .digest('hex');

  const workingDirectoryHash = crypto
    .createHash('sha256')
    .update(inputs['working-directory'] || '.')
    .digest('hex')
    .slice(0, 7);

  const nodeModulesCachePrefix = [
    inputs['cache-prefix'],
    runsOn,
    (inputs['node-version'] || 'lts/gallium').replace(/[/.]/g, '-'),
    packageManager,
    workingDirectoryHash,
  ].join('-');

  const outputs = {
    lockfile,
    'dependencies-hash': dependenciesHash,
    'get-cache-dir-command': getCacheDirCommand,
    'hash-files': hashFiles,
    'hash-strategy': hashStrategy,
    'install-command': installCommand,
    'node-modules-cache-prefix': nodeModulesCachePrefix,
    'node-modules-cache-suffix':
      hashStrategy === 'dependencies' ? `deps_${dependenciesHash}` : `lock_${lockfilesHash}`,
    'package-manager-version-command': versionCommand,
    'package-manager': packageManager,
    'working-directory-hash': workingDirectoryHash,
  };

  Object.entries(outputs).forEach(([name, value]) => {
    core.setOutput(name, value);
  });

  // Log for debugging purposes.
  console.log({
    ...outputs,
    'is-monorepo': isMonorepo,
    'git-root': gitRoot,
    lockfiles,
    'lockfiles-hash': lockfilesHash,
    'package-json-files': packageJsonFiles,
  });
};
