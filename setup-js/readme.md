# setup-js

- sets up desired Node.js version
- restores & saves global npm/Yarn cache
- restores & saves node_modules cache
- installs dependencies

## Usage

```yml
- name: Setup Node and install dependencies
  uses: monterail/github-actions/setup-js@main
  with:
    # Node version to use.
    #
    # Default: 'lts/gallium' (Node 16)
    node-version: ''

    # Which package manager to use.
    # Choices: npm, yarn
    #
    # Default: 'npm'
    package-manager: ''

    # Working directory to run this action in.
    #
    # Default: '.' (root directory of your repository)
    working-directory: ''

    # Command to install npm dependencies.
    #
    # Defaults:
    # - 'npm i' (package-manager = npm)
    # - 'yarn install' (package-manager = yarn)
    install-command: ''

    # Additional arguments to pass to install command.
    # Example: '--force'
    install-args: ''

    # Prefix to add to global/ node_modules cache.
    # Useful if you want to force cache miss.
    #
    # Default: 'v1'
    cache-prefix: ''

    # If global npm/Yarn cache and local node_modules directory
    # should be downloaded.
    # Set to false to disable cache.
    #
    # Default: true
    enable-cache: true

    # Whether to use hash of lockfile (package-lock.json or yarn.lock)
    # or hash or dependencies inside package.json as part of cache key
    # for global cache/ node_modules cache.
    # Choices: 'lockfile', 'dependencies'.
    # IMPORTANT: This will get overwritten to 'dependencies' if there is no lockfile.
    #
    # Defaults:
    # - lockfile (if a lockfile is found in current directory)
    # - dependencies (if no lockfile is found in current directory)
    hash-strategy: ''
```
