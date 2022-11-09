import esbuild, { BuildIncremental, BuildOptions, Plugin } from 'esbuild';
import imageInline from 'esbuild-plugin-inline-image';
import { sassPlugin } from 'esbuild-sass-plugin';
import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs/promises';
import { htmlTemplate, jsTemplate } from './templates';
import { BuildResultWithMeta, Instrument } from './types';
import { BuildLogger } from './logger';

/**
 * Override module resolution of specified imports.
 */
const resolve = (options: { [module: string]: string}): Plugin => ({
    name: 'resolve',
    setup(build) {
        build.onResolve(
            { filter: new RegExp(`^(${Object.keys(options).join('|')})$`) },
            (args) => ({ path: options[args.path] }),
        );
    },
});

/**
 * Include specified CSS bundles in main bundle.
 */
const includeCSS = (modules: string[]): Plugin => ({
    name: 'includeCSS',
    setup(build) {
        build.onEnd(() => {
            const cssPath = path.join(path.dirname(build.initialOptions.outfile!), 'bundle.css');
            modules.map(async (mod) => {
                const css = await fs.readFile(mod);
                await fs.appendFile(cssPath, css);
            });
        });
    },
});

/**
 * Write `build_meta.json` files containing build data into the bundle directory.
 */
const writeMetafile: Plugin = {
    name: 'writeMetafile',
    setup(build) {
        build.onEnd((result) => {
            if (result.errors.length === 0) {
                fs.writeFile(
                    path.join(path.dirname(build.initialOptions.outfile!), 'build_meta.json'),
                    JSON.stringify(result.metafile),
                );
            }
        });
    },
};

/**
 * Export simulator packages to `PackageSources` directory
 */
const writePackageSources = (logger: BuildLogger, instrumentName: string, imports: string[] = [], isInteractive = true): Plugin => ({
    name: 'writePackageSources',
    setup(build) {
        build.onEnd(async (result) => {
            if (result.errors.length === 0) {
                const jsPath = path.join(path.dirname(build.initialOptions.outfile!), 'bundle.js');
                const cssPath = path.join(path.dirname(build.initialOptions.outfile!), 'bundle.css');

                const js = await fs.readFile(jsPath, { encoding: 'utf-8' });
                const css = await fs.readFile(cssPath, { encoding: 'utf-8' });

                const packageTarget = path.join(process.env.PACKAGES_DIR, instrumentName);
                await fs.mkdir(packageTarget, { recursive: true });

                await fs.writeFile(path.join(packageTarget, 'template.html'), htmlTemplate(instrumentName, imports, js, css));
                await fs.writeFile(path.join(packageTarget, 'template.js'), jsTemplate(process.env.PACKAGE_NAME, instrumentName, isInteractive));
            }
        });
    },
});

async function build(instrument: Instrument, logger: BuildLogger, module = false): Promise<BuildResultWithMeta> {
    const configFile = JSON.parse(await fs.readFile(path.join(instrument.directory, 'config.json'), { encoding: 'utf-8' }));

    const buildOptions: BuildOptions & { incremental: true, metafile: true } = {
        entryPoints: [path.join(instrument.directory, instrument.input ?? configFile.index)],
        outfile: path.join(process.env.BUNDLES_DIR, instrument.name, module ? '/module/module.mjs' : 'bundle.js'),
        external: ['*.ttf'],
        bundle: true,
        target: 'es2017',
        format: (module ? 'esm' : 'iife'),
        logLevel: 'silent',
        incremental: true,
        metafile: true,
        plugins: [imageInline({ limit: -1 }), sassPlugin()],
        define: {
            'process.env.MODULE': module.toString(),
            'process.env.NODE_ENV': `"${process.env.NODE_ENV}"`,
        },
    };

    if (process.env.OUTPUT_METAFILE) {
        buildOptions.plugins!.push(writeMetafile);
    }

    // Resolve submodules to their bundles
    if (instrument.modules) {
        buildOptions.plugins!.push(
            resolve(Object.fromEntries(
                instrument.modules.map((mod) => [
                    mod.import,
                    path.join(process.env.BUNDLES_DIR, mod.name, '/module/module.mjs'),
                ]),
            )),
            includeCSS(instrument.modules.map((mod) => (
                path.join(process.env.BUNDLES_DIR, mod.name, '/module/module.css')
            ))),
        );
    }

    if (!instrument.skipPackageSources && !module) {
        buildOptions.plugins!.push(writePackageSources(logger, instrument.name, instrument.imports, configFile.isInteractive));
    }

    return esbuild.build(buildOptions);
}

export async function buildInstrument(instrument: Instrument, logger: BuildLogger, module = false): Promise<BuildResultWithMeta> {
    let moduleResults: BuildResultWithMeta[] = [];

    // Recursively build included submodules
    if (instrument.modules) {
        moduleResults = await Promise.all(instrument.modules.map((module) => buildInstrument(module, logger, true)));

        // Skip main instrument bundling if the submodule fails.
        for (const res of moduleResults) {
            if (res.errors.length > 0) {
                return res;
            }
        }

        moduleResults.forEach((res) => res.rebuild?.dispose());
    }

    const startTime = performance.now();
    const { success, result } = await build(instrument, logger, module)
        .then((result: BuildResultWithMeta) => ({
            success: true,
            result,
        }))
        .catch((result: BuildResultWithMeta) => {
            logger.buildFailed(result.errors);
            return {
                success: false,
                result,
            };
        });
    const endTime = performance.now();

    if (success) {
        logger.buildComplete(instrument.name, endTime - startTime, result);
    }

    return result;
}

export async function watchInstrument(instrument: Instrument, logger: BuildLogger, module = false): Promise<BuildResultWithMeta> {
    // Recursively watch included submodules
    if (instrument.modules) {
        await Promise.all(instrument.modules.map((module) => watchInstrument(module, logger, true)));
    }

    let result = await buildInstrument(instrument, logger, module);

    // Chokidar needs a list of files to watch, but we don't get the metafile on a failed build.
    if (result.errors.length > 0) {
        return result;
    }

    const watcher = chokidar.watch(Object.keys(result.metafile.inputs).map((input) => path.resolve(input)));
    watcher.on('change', async (filePath) => {
        logger.changeDetected(filePath);

        const startTime = performance.now();
        const { success, res } = await result.rebuild()
            .then((res: BuildIncremental) => ({
                success: true,
                res: res as BuildResultWithMeta,
            }))
            .catch((res: BuildIncremental) => {
                logger.buildFailed(res.errors);
                return {
                    success: false,
                    res: res as BuildResultWithMeta,
                };
            });
        const endTime = performance.now();

        if (success) {
            result = res as BuildResultWithMeta;

            logger.buildComplete(instrument.name, endTime - startTime, result);

            const watchedFiles = watcher.getWatched();
            const bundledFiles = Object.keys(result.metafile.inputs).map((input) => path.resolve(input));

            // Watch files that have been added to the bundle
            for (const file of bundledFiles) {
                if (!watchedFiles[path.dirname(file)]?.includes(path.basename(file))) {
                    watcher.add(file);
                }
            }
            // Unwatch files that are no longer included in the bundle
            for (const [dir, files] of Object.entries(watchedFiles)) {
                for (const file of files) {
                    const filePath = path.join(dir, file);
                    if (!bundledFiles.includes(filePath)) {
                        watcher.unwatch(filePath);
                    }
                }
            }
        }
    });

    return result;
}
