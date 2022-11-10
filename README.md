# Mach

**Mach** is an ultra-fast transpiler and bundler for use with MSFS (Microsoft Flight Simulator 2020) instruments. Unlike other bundling tools such as *rollup* or *webpack*, Mach has been built from the ground up with the sole purpose of serving the MSFS development community's needs.

![](https://i.imgur.com/9pRuFG9.gif)

## Features

Mach currently supports bundling both JavaScript and TypeScript React instruments, along with any CSS or SCSS stylesheets and images that are included. Instruments built with the [MSFS Avionics Framework](https://microsoft.github.io/msfs-avionics-mirror/docs/intro/) are also supported, but require additional steps to ensure compatibility as described [here](#msfs-avionics-framework-compatibility).

Mach also allows you to create nested instruments, enabling you to bundle MSFS Avionics instruments separately and import them into your React instrument.

## Usage

### CLI

#### Options

- `-c, --config <filename>` specify path to configuration file (default: `./mach.config.json`)
- `-b, --bundles <dirname>` bundles output directory (default: `./bundles`)
- `-f, --filter <regex>` regex filter of included instrument names
- `--output-metafile` output `build_meta.json` file to bundles directory

#### `mach build [options]`

The `build` command will simply go through each instrument defined in your [configuration](#configuration), then output the bundles and package source files to the configured directories.

#### `mach watch [options]`

The `watch` command will first build each instrument in the configuration, and then watch the source files for changes in order to re-bundle the instrument. **If there was an error while bundling the instrument in the beginning, the watcher will not run.**


### JavaScript

#### `async function machBuild(conf: MetaConfig, filter?: RegExp)`

This function has the same behavior as the [`mach build [options]`](#mach-build-options) CLI command.

#### `async function machWatch(conf: MetaConfig, filter?: RegExp)`

This function has the same behavior as the [`mach watch [options]`](#mach-watch-options) CLI command.


## Configuration

Whether you supply the configuration with the `mach.config.js` file to the CLI or with a JavaScript object to the API, the structure is identical.
```ts
interface MachConfig {
    /** Name of package, used for bundling simulator packages. */
    packageName: string;
    /** Path to PackageSources directory. */
    packageDir: string;
    /** esbuild plugins to include (https://github.com/esbuild/community-plugins) */
    plugins?: Plugin[];
    /** All instruments to be bundled by Mach. */
    instruments: Instrument[];
}

interface Instrument {
    /** Instrument name, used as directory name for bundles and packages. */
    name: string;
    /** Path to directory containing instrument `config.json`. */
    directory: string;
    /** Entrypoint filename for instrument. Defaults to `index` value in instrument `config.json`. */
    input?: string;

    /** Imports to include in simulator package. */
    imports?: string[];
    /** Skip writing simulator package. */
    skipPackageSources?: boolean;

    /** Instruments to import as ESM modules. */
    modules?: Instrument[];
    /** (Required for instruments included as `modules`) Import name to resolve to the bundled module. */
    resolve?: string;
}
```

### Example
```js
const imageInline = require('esbuild-plugin-inline-image');

/** @type { import('@synaptic-simulations/mach').MachConfig } */
module.exports = {
    packageName: 'a22x',
    packageDir: 'PackageSources',
    plugins: [imageInline({ limit: -1 })],
    instruments: [
        {
            name: 'DisplayUnits',
            directory: 'src/instruments/src/DisplayUnits',
            imports: ['/JS/dataStorage.js'],
            modules: [{
                name: 'PFD',
                resolve: '@instruments/PFD',
                directory: 'src/instruments/src/PFD',
            }],
        },
        {
            name: 'CTP',
            directory: 'src/instruments/src/CTP',
            imports: ['/JS/dataStorage.js'],
        },
        {
            name: 'ISI',
            directory: 'src/instruments/src/ISI',
        },
        // Separate bundle for ACE, does not get exported to package directory.
        {
            name: 'PFD',
            directory: 'src/instruments/src/PFD',
            skipPackageSources: true,
        },
    ],
};
```


## MSFS Avionics Framework Compatibility

For compatibility with Mach, a modification must be made to the `msfs-avionics` source code:
```diff
# src/sdk/components/FSComponent.ts
- [357]   if (typeof type === 'function' && type.name === 'Fragment') {
+ [357]   if (typeof type === 'function' && type.name === Fragment.name) {
```
These changes are also available through the [`@synaptic-simulations/msfssdk`](https://www.npmjs.com/package/@synaptic-simulations/msfssdk) npm package.
