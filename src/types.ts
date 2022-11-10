/*
 * SPDX-FileCopyrightText: 2022 Synaptic Simulations and its contributors
 * SPDX-License-Identifier: MIT
 */

import { BuildIncremental, Metafile } from 'esbuild';
import { z } from 'zod';

export type BuildResultWithMeta = BuildIncremental & { metafile: Metafile };

export interface Instrument {
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

export const InstrumentSchema: z.ZodType<Instrument> = z.lazy(() => z.object({
    name: z.string(),
    directory: z.string(),
    input: z.optional(z.string()),

    imports: z.optional(z.array(z.string())),
    skipPackageSources: z.optional(z.boolean()),

    modules: z.optional(z.array(InstrumentSchema)),
    resolve: z.optional(z.string()),
}));

export interface MachConfig {
    /** Name of package, used for bundling simulator packages. */
    packageName: string;
    /** Path to PackageSources directory. */
    packageDir: string;
    /** All instruments to be bundled by Mach. */
    instruments: Instrument[];
}

export const MachConfigSchema = z.object({
    packageName: z.string(),
    packageDir: z.string(),
    instruments: z.array(InstrumentSchema),
});
