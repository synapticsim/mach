/*
 * SPDX-FileCopyrightText: 2022 Synaptic Simulations and its contributors
 * SPDX-License-Identifier: MIT
 */

import esbuild, { BuildIncremental, BuildOptions } from 'esbuild';
import chokidar from 'chokidar';
import path from 'path';
import { BuildResultWithMeta, Instrument, MachConfig } from './types';
import { BuildLogger } from './logger';
import { includeCSS, resolve, writeMetafile, writePackageSources } from './plugins';

async function build(config: MachConfig, instrument: Instrument, logger: BuildLogger, module = false): Promise<BuildResultWithMeta> {
    const envVars = Object.fromEntries(
        Object.entries(process.env)
            .filter(([key]) => /^[A-Za-z_]*$/.test(key))
            .map(([key, value]) => [`process.env.${key}`, `"${value?.replace(/\\/g, '/') ?? ''}"`]),
    );

    const buildOptions: BuildOptions & { incremental: true, metafile: true } = {
        entryPoints: [instrument.index],
        outfile: path.join(process.env.BUNDLES_DIR, instrument.name, module ? '/module/module.mjs' : 'bundle.js'),
        external: ['/Images/*', '/Fonts/*'],
        bundle: true,
        target: 'es2017',
        format: (module ? 'esm' : 'iife'),
        logLevel: 'silent',
        incremental: true,
        metafile: true,
        plugins: config.plugins ? [...config.plugins] : [],
        define: {
            ...envVars,
            'process.env.MODULE': module.toString(),
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
                    mod.resolve,
                    path.join(process.env.BUNDLES_DIR, mod.name, '/module/module.mjs'),
                ]),
            )),
            includeCSS(instrument.modules.map((mod) => (
                path.join(process.env.BUNDLES_DIR, mod.name, '/module/module.css')
            ))),
        );
    }

    if (instrument.simulatorPackage && !module) {
        buildOptions.plugins!.push(writePackageSources(logger, instrument));
    }

    return esbuild.build(buildOptions);
}

export async function buildInstrument(config: MachConfig, instrument: Instrument, logger: BuildLogger, module = false): Promise<BuildResultWithMeta> {
    let moduleResults: BuildResultWithMeta[] = [];

    // Recursively build included submodules
    if (instrument.modules) {
        moduleResults = await Promise.all(instrument.modules.map((module) => buildInstrument(config, module, logger, true)));

        // Skip main instrument bundling if the submodule fails.
        for (const res of moduleResults) {
            if (res.errors.length > 0) {
                return res;
            }
        }

        moduleResults.forEach((res) => res.rebuild?.dispose());
    }

    const startTime = performance.now();
    const { success, result } = await build(config, instrument, logger, module)
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

export async function watchInstrument(config: MachConfig, instrument: Instrument, logger: BuildLogger, module = false): Promise<BuildResultWithMeta> {
    // Recursively watch included submodules
    if (instrument.modules) {
        await Promise.all(instrument.modules.map((module) => watchInstrument(config, module, logger, true)));
    }

    let result = await buildInstrument(config, instrument, logger, module);

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
