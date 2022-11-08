import { BuildIncremental, Metafile } from 'esbuild';
import { z } from 'zod';

export interface Instrument {
    /** Instrument name, used as directory name for bundles and packages. */
    name: string;
    /** Path to directory containing instrument `config.json`. */
    directory: string;
    /** Entrypoint filename for instrument. Defaults to `index` value in instrument `config.json`. */
    input?: string;

    /** Imports to include in simulator export. */
    imports?: string[];
    /** Alows skipping simulator export */
    skipPackageSources?: boolean;

    /** Instruments to import as ESM modules. */
    modules?: Instrument[];
    /** Required for modules. Import to resolve to the bundled module. */
    import?: string;
}

export const InstrumentSchema: z.ZodType<Instrument> = z.lazy(() => z.object({
    name: z.string(),
    directory: z.string(),
    input: z.optional(z.string()),

    imports: z.optional(z.array(z.string())),
    skipPackageSources: z.optional(z.boolean()),

    modules: z.optional(z.array(InstrumentSchema)),
    import: z.optional(z.string()),
}));

export interface MachConfig {
    /** Path to PackageSources directory */
    packagesDir: string;
    /** All instruments to be bundled by Mach */
    instruments: Instrument[];
}

export const MachConfigSchema = z.object({
    packagesDir: z.string(),
    instruments: z.array(InstrumentSchema),
});

export interface ParsedCommandArgs {
    config: MachConfig;
    bundles: string;
    out: string;
    filter?: RegExp;
}

export type BuildResultWithMeta = BuildIncremental & { metafile: Metafile };
