/*
 * SPDX-FileCopyrightText: 2022 Synaptic Simulations and its contributors
 * SPDX-License-Identifier: MIT
 */

import path from "node:path";
import chokidar from "chokidar";
import esbuild, { type BuildIncremental, type BuildOptions } from "esbuild";

import type { BuildLogger } from "./logger";
import { includeCSS, resolve, writeMetafile, writePackageSources } from "./plugins";
import { type BuildResultWithMeta, ESBUILD_ERRORS, type Instrument, type MachArgs, type MachConfig } from "./types";

async function build(
    args: MachArgs,
    instrument: Instrument,
    logger: BuildLogger,
    module = false,
): Promise<BuildResultWithMeta> {
    const bundlesDir = args.bundles ?? "./bundles";

    const envVars = Object.fromEntries(
        Object.entries(process.env)
            .filter(([key]) => /^[A-Za-z_]*$/.test(key))
            .map(([key, value]) => [
                `process.env.${key}`,
                value?.toLowerCase() === "true" || value?.toLowerCase() === "false"
                    ? value.toLowerCase()
                    : `"${value?.replace(/\\/g, "/").replace(/"/g, '\\"') ?? ""}"`,
            ]),
    );

    const buildOptions: BuildOptions & { incremental: true; metafile: true } = {
        absWorkingDir: process.cwd(),
        entryPoints: [instrument.index],
        outfile: path.join(bundlesDir, instrument.name, module ? "/module/module.mjs" : "bundle.js"),
        external: ["/Images/*", "/Fonts/*"],
        incremental: true,
        metafile: true,
        bundle: true,
        target: "es2017",
        format: module ? "esm" : "iife",
        logLevel: "silent",
        logOverride: args.werror ? ESBUILD_ERRORS : undefined,
        sourcemap: args.outputSourcemaps ? "inline" : undefined,
        minify: args.minify,
        plugins: [...(args.config.plugins ?? []), ...(instrument.plugins ?? [])],
        define: {
            ...envVars,
            "process.env.MODULE": module.toString(),
        },
    };

    if (args.outputMetafile) {
        buildOptions.plugins?.push(writeMetafile);
    }

    // Resolve submodules to their bundles
    if (instrument.modules) {
        buildOptions.plugins?.push(
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
        buildOptions.plugins?.push(writePackageSources(args, instrument));
    }

    return esbuild.build(buildOptions);
}

export async function buildInstrument(
    args: MachArgs,
    instrument: Instrument,
    logger: BuildLogger,
    module = false,
): Promise<BuildResultWithMeta> {
    let moduleResults: BuildResultWithMeta[] = [];

    // Recursively build included submodules
    if (instrument.modules) {
        moduleResults = await Promise.all(
            instrument.modules.map((module) => buildInstrument(args, module, logger, true)),
        );

        // Skip main instrument bundling if the submodule fails.
        for (const result of moduleResults) {
            if (result.errors.length > 0) {
                return result;
            }
        }

        for (const result of moduleResults) {
            result.rebuild?.dispose();
        }
    }

    const startTime = performance.now();
    const { success, result } = await build(args, instrument, logger, module)
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

    let result = await buildInstrument(args, instrument, logger, module);

    // Chokidar needs a list of files to watch, but we don't get the metafile on a failed build.
    if (result.errors.length > 0) {
        return result;
    }

    const builtFiles = Object.keys(result.metafile.inputs).map(resolveFilename);
    const watcher = chokidar.watch(builtFiles);
    watcher.on("change", async (filePath) => {
        logger.changeDetected(filePath);

        const startTime = performance.now();
        const { success, res } = await result
            .rebuild()
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
        }
    });

    return result;
}
