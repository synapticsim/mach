/*
 * SPDX-FileCopyrightText: 2022 Synaptic Simulations and its contributors
 * SPDX-License-Identifier: MIT
 */

import { buildInstrument, watchInstrument } from "./esbuild";
import { BuildLogger } from "./logger";
import type { BuildResultWithMeta, MachArgs } from "./types";

/**
 * Run a one-off build with provided arguments.
 * @returns List of all build results.
 */
export async function machBuild(args: MachArgs): Promise<PromiseSettledResult<BuildResultWithMeta>[]> {
    const instruments = args.config.instruments.filter((instrument) => args.filter?.test(instrument.name) ?? true);

    return Promise.allSettled(
        instruments.map((instrument) =>
            buildInstrument(args, instrument, new BuildLogger(instrument.name, args.verbose)),
        ),
    );
}

/**
 * Continuously build instruments when files are updated.
 * @returns list of initial build results.
 */
export async function machWatch(args: MachArgs): Promise<PromiseSettledResult<BuildResultWithMeta>[]> {
    const instruments = args.config.instruments.filter((instrument) => args.filter?.test(instrument.name) ?? true);

    return Promise.allSettled(
        instruments.map((instrument) =>
            watchInstrument(args, instrument, new BuildLogger(instrument.name, args.verbose)),
        ),
    );
}
