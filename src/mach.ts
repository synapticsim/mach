/*
 * SPDX-FileCopyrightText: 2022 Synaptic Simulations and its contributors
 * SPDX-License-Identifier: MIT
 */

import chalk from "chalk";
import signale from "signale";

import { buildInstrument, watchInstrument } from "./esbuild";
import { BuildLogger } from "./logger";
import type { BuildResultWithMeta, MachArgs } from "./types";

/**
 * Run a one-off build with provided arguments.
 * @returns List of all build results.
 */
export async function machBuild(args: MachArgs): Promise<BuildResultWithMeta[]> {
    const instruments = args.config.instruments.filter((instrument) => args.filter?.test(instrument.name) ?? true);

    signale.start(`Building ${instruments.length} instruments\n`);

    const startTime = performance.now();

    return Promise.all(
        instruments.map(async (instrument) => {
            const result = await buildInstrument(args, instrument, new BuildLogger(instrument.name, args.verbose));
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

        return results;
    });
}

/**
 * Continuously build instruments when files are updated.
 * @returns list of initial build results.
 */
export async function machWatch(args: MachArgs): Promise<BuildResultWithMeta[]> {
    const instruments = args.config.instruments.filter((instrument) => args.filter?.test(instrument.name) ?? true);

    return Promise.all(
        instruments.map((instrument) =>
            watchInstrument(args, instrument, new BuildLogger(instrument.name, args.verbose), false),
        ),
    ).then((results) => {
        if (results.some((res) => res.errors.length > 0)) {
            signale.error("Watch mode requires a build-able bundle to initialize");
            process.exit(1);
        }
        signale.watch("Watching for changes\n");

        return results;
    });
}
