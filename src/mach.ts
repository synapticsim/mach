/*
 * SPDX-FileCopyrightText: 2022 Synaptic Simulations and its contributors
 * SPDX-License-Identifier: MIT
 */

import { buildInstrument, watchInstrument } from "./esbuild";
import { BuildLogger } from "./logger";
import type { BuildResultWithMeta, Instrument, MachArgs } from "./types";

/**
 * Run a one-off build with provided instruments and arguments.
 * @returns List of all build results.
 */
export async function machBuild(
    instruments: Instrument[],
    args: MachArgs,
): Promise<PromiseSettledResult<BuildResultWithMeta>[]> {
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
export async function machWatch(
    instruments: Instrument[],
    args: MachArgs,
): Promise<PromiseSettledResult<BuildResultWithMeta>[]> {
    return Promise.allSettled(
        instruments.map((instrument) =>
            watchInstrument(args, instrument, new BuildLogger(instrument.name, args.verbose)),
        ),
    );
}
