/*
 * SPDX-FileCopyrightText: 2022 Synaptic Simulations and its contributors
 * SPDX-License-Identifier: MIT
 */

import path from "node:path";
import chalk from "chalk";
import signale from "signale";
import { buildInstrument, watchInstrument } from "./esbuild";
import { BuildLogger } from "./logger";
import type { MachConfig } from "./types";

function configureEnvironment(conf: MachConfig) {
    process.env.CONFIG_PATH = process.env.CONFIG_PATH ?? path.join(process.cwd(), "mach.config.js");
    process.env.BUNDLES_DIR = process.env.BUNDLES_DIR ?? path.join(process.cwd(), "bundles");
    process.env.OUTPUT_METAFILE = process.env.OUTPUT_METAFILE ?? false;

    process.env.PACKAGE_NAME = conf.packageName;
    process.env.PACKAGE_DIR = path.join(process.cwd(), conf.packageDir);
}

export async function machBuild(conf: MachConfig, filter?: RegExp) {
    configureEnvironment(conf);

    const instruments = conf.instruments.filter((instrument) => filter?.test(instrument.name) ?? true);

    signale.start(`Building ${instruments.length} instruments\n`);

    const startTime = performance.now();
    Promise.all(
        instruments.map(async (instrument) => {
            const result = await buildInstrument(conf, instrument, new BuildLogger(instrument.name));
            result.rebuild?.dispose();
            return result;
        }),
    ).then((results) => {
        const stopTime = performance.now();
        const successCount = results.filter((res) => res.errors.length === 0).length;
        if (successCount > 0) {
            signale.success(
                `Built ${results.filter((res) => res.errors.length === 0).length} instruments in`,
                chalk.greenBright(`${(stopTime - startTime).toFixed()} ms`),
                "\n",
            );
        } else {
            signale.error(`All ${instruments.length} instruments failed to build`);
        }
        if (successCount < instruments.length) {
            process.exit(1);
        }
    });
}

export async function machWatch(conf: MachConfig, filter?: RegExp) {
    configureEnvironment(conf);

    const instruments = conf.instruments.filter((instrument) => filter?.test(instrument.name) ?? true);

    Promise.all(
        instruments.map((instrument) => watchInstrument(conf, instrument, new BuildLogger(instrument.name))),
    ).then((results) => {
        if (results.some((res) => res.errors.length > 0)) {
            signale.error("Watch mode requires a build-able bundle to initialize");
            process.exit(1);
        }
        signale.watch("Watching for changes\n");
    });
}
