/*
 * SPDX-FileCopyrightText: 2022 Synaptic Simulations and its contributors
 * SPDX-License-Identifier: MIT
 */

import path from "node:path";
import chokidar from "chokidar";
import esbuild, { type BuildOptions, type BuildFailure } from "esbuild";

import type { BuildLogger } from "./logger";
import { environment, includeCSS, resolve, writeMetafile, writePackageSources } from "./plugins";
import { type BuildResultWithMeta, ESBUILD_ERRORS, type Instrument, type MachArgs } from "./types";

function getBuildOptions(args: MachArgs, instrument: Instrument, logger: BuildLogger, module = false): BuildOptions {
    const bundlesDir = args.bundles ?? "./bundles";

    const options: BuildOptions = {
        absWorkingDir: process.cwd(),
        entryPoints: [instrument.index],
        outfile: path.join(bundlesDir, instrument.name, module ? "/module/module.mjs" : "bundle.js"),
        external: ["/Images/*", "/Fonts/*"],
        metafile: true,
        bundle: true,
        target: "es2017",
        format: module ? "esm" : "iife",
        logLevel: "silent",
        logOverride: args.werror ? ESBUILD_ERRORS : undefined,
        sourcemap: args.outputSourcemaps ? "inline" : undefined,
        minify: args.minify,
        plugins: [
            environment(logger, { __MACH_IS_MODULE: module.toString() }),
            ...(args.config.plugins ?? []),
            ...(instrument.plugins ?? []),
        ],
    };

    if (args.outputMetafile) {
        options.plugins!.push(writeMetafile);
    }

    // Resolve submodules to their bundles
    if (instrument.modules) {
        options.plugins!.push(
            resolve(
                Object.fromEntries(
                    instrument.modules.map((mod) => [
                        mod.resolve,
                        path.join(bundlesDir, mod.name, "/module/module.mjs"),
                    ]),
                ),
            ),
            includeCSS(instrument.modules.map((mod) => path.join(bundlesDir, mod.name, "/module/module.css"))),
        );
    }

    if (instrument.simulatorPackage && !args.skipSimulatorPackage && !module) {
        options.plugins!.push(writePackageSources(args, instrument));
    }

    return options;
}

export async function buildInstrument(
    args: MachArgs,
    instrument: Instrument,
    logger: BuildLogger,
    module = false,
): Promise<BuildResultWithMeta> {
    // Recursively build included submodules
    if (instrument.modules) {
        await Promise.all(instrument.modules.map((module) => buildInstrument(args, module, logger, true)));
    }

    const options = getBuildOptions(args, instrument, logger, module);

    const startTime = performance.now();
    return await esbuild
        .build(options)
        .then((result) => {
            logger.buildComplete(instrument.name, performance.now() - startTime, result);
            return result;
        })
        .catch((failure) => {
            logger.buildFailed((failure as BuildFailure).errors);
            throw failure;
        });
}

function resolveFilename(input: string): string {
    const cwdIndex = input.indexOf(process.cwd());
    return path.resolve(cwdIndex >= 0 ? input.slice(cwdIndex) : input);
}

export async function watchInstrument(
    args: MachArgs,
    instrument: Instrument,
    logger: BuildLogger,
    module = false,
): Promise<BuildResultWithMeta> {
    // Recursively watch included submodules
    if (instrument.modules) {
        await Promise.all(instrument.modules.map((module) => watchInstrument(args, module, logger, true)));
    }

    const options = getBuildOptions(args, instrument, logger, module);
    const context = await esbuild.context(options);

    const startTime = performance.now();
    const result: BuildResultWithMeta = await context
        .rebuild()
        .then((result) => {
            logger.buildComplete(instrument.name, performance.now() - startTime, result);
            return result;
        })
        .catch((failure) => {
            console.error(failure);
            logger.buildFailed((failure as BuildFailure).errors);
            throw failure;
        });

    const builtFiles = Object.keys(result.metafile.inputs).map(resolveFilename);
    const watcher = chokidar.watch(builtFiles);
    watcher.on("change", async (filePath) => {
        logger.changeDetected(filePath);

        const startTime = performance.now();
        await context
            .rebuild()
            .then((result: BuildResultWithMeta) => {
                logger.buildComplete(instrument.name, performance.now() - startTime, result);
                const watchedFiles = watcher.getWatched();
                const bundledFiles = Object.keys(result.metafile.inputs).map(resolveFilename);

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
            })
            .catch((failure) => {
                console.error(failure);
                logger.buildFailed((failure as BuildFailure).errors);
            });
    });

    return result;
}
