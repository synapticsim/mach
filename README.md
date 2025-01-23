# Mach

**Mach** is an ultra-fast transpiler and bundler for use with MSFS (Microsoft Flight Simulator 2020) instruments. Unlike other bundling tools such as *rollup* or *webpack*, Mach has been built from the ground up with the sole purpose of serving the MSFS development community's needs.

![](https://i.imgur.com/9pRuFG9.gif)

## Features

Mach currently supports bundling both JavaScript and TypeScript React instruments, along with any CSS or SCSS stylesheets and images that are included. Instruments built with the [MSFS Avionics Framework](https://microsoft.github.io/msfs-avionics-mirror/docs/intro/) are also supported, but require additional steps to ensure compatibility as described [here](#msfs-avionics-framework-compatibility).

Mach also allows you to create nested instruments, enabling you to bundle MSFS Avionics instruments separately and import them into your React instrument.

## Usage

> [!IMPORTANT]
> Please ensure that you are using Node 22!

### CLI

#### Options

- `-c, --config <filename>` specify path to configuration file (default: `./mach.config.js`)
- `-d, --work-in-config-dir` use config directory as working directory
- `-b, --bundles <dirname>` bundles output directory (default: `./bundles`)
- `-e, --werror` makes all warnings into errors
- `-f, --filter <regex>` regex filter of included instrument names
- `-m, --minify` minify bundle code
- `-s, --skip-simulator-package` skips writing simulator package templates
- `-t, --output-metafile` output `build_meta.json` file to bundles directory
- `-u, --output-sourcemaps` append sourcemaps to the end of bundle files
- `-v, --verbose` output additional build information

#### `mach build [options]`

The `build` command will simply go through each instrument defined in your [configuration](#configuration), then output the bundles and package source files to the configured directories.

#### `mach watch [options]`

The `watch` command will first build each instrument in the configuration, and then watch the source files for changes in order to re-bundle the instrument. **If there was an error while bundling the instrument in the beginning, the watcher will not run.**


### JavaScript

#### `async function machBuild(conf: MachConfig, filter?: RegExp)`

This function has the same behavior as the [`mach build [options]`](#mach-build-options) CLI command.

#### `async function machWatch(conf: MachConfig, filter?: RegExp)`

This function has the same behavior as the [`mach watch [options]`](#mach-watch-options) CLI command.


## Configuration

Whether you supply the configuration with the `mach.config.js` file to the CLI or with a JavaScript object to the API, the structure is identical.
```ts
interface PackageSettings {
    /**
     * Specifies type of instrument.
     * - `React` instruments will be created with a `BaseInstrument` harness that exposes an `MSFS_REACT_MOUNT` element for mounting.
     * - `BaseInstrument` instruments must specify the `instrumentId` and `mountElementId` to match the instrument configuration.
     */
    type: string;
    /** Final template filename. Defaults to `template` */
    fileName?: string;
    /** Simulator packages to import in the HTML template. */
    imports?: string[];
}

interface ReactInstrumentPackageSettings extends PackageSettings {
    type: 'react';
    /** Optional parameter to specify template ID. Defaults to `Instrument.name`. */
    templateId?: string;
    /** Whether the instrument is interactive or not. Defaults to `true`. */
    isInteractive?: boolean;
}

interface BaseInstrumentPackageSettings extends PackageSettings {
    type: 'baseInstrument';
    /**
     * Required for `BaseInstrument` instruments.
     * This value must match the return value from the `BaseInstrument.templateID()` function.
     * */
    templateId: string;
    /**
     * Required for `BaseInstrument` instruments.
     * This value must match the ID in your call to `FSComponent.render()`..
     */
    mountElementId: string;
}

interface Instrument {
    /** Instrument name, used as directory name for bundles and packages. */
    name: string;
    /** Entrypoint filename for instrument. */
    index: string;

    /** When passed a configuration object, enables a simulator package export. */
    simulatorPackage?: ReactInstrumentPackageSettings | BaseInstrumentPackageSettings;

    /** Instruments to import as ESM modules. */
    modules?: Instrument[];
    /** (Required for instruments included as `modules`) Import name to resolve to the bundled module. */
    resolve?: string;
}

interface MachConfig {
    /** Name of package, used for bundling simulator packages. */
    packageName: string;
    /** Path to directory containing `html_ui`. */
    packageDir: string;
    /**
     * esbuild configuration overrides (<https://esbuild.github.io/api/>)
     * entryPoints, outfile, format, metafile, bundle are not overridable.
     */
    esbuild?: BuildOptions;
    /** All instruments to be bundled by Mach. */
    instruments: Instrument[];
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
            index: 'src/instruments/src/DisplayUnits/index.tsx',
            simulatorPackage: {
                type: 'react',
                imports: ['/JS/dataStorage.js'],
            },
            modules: [{
                name: 'PFD',
                resolve: '@instruments/PFD',
                index: 'src/instruments/src/PFD/index.tsx',
            }],
        },
        {
            name: 'CTP',
            index: 'src/instruments/src/CTP/index.tsx',
            simulatorPackage: {
                type: 'react',
                imports: ['/JS/dataStorage.js'],
            },
        },
        {
            name: 'ISI',
            index: 'src/instruments/src/ISI/index.tsx',
            simulatorPackage: {
                type: 'react',
                imports: ['/JS/dataStorage.js'],
            },
        },
    ],
};
```
