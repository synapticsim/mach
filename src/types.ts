/*
 * SPDX-FileCopyrightText: 2022 Synaptic Simulations and its contributors
 * SPDX-License-Identifier: MIT
 */

import type { BuildIncremental, LogLevel, Metafile, Plugin } from "esbuild";
import { z } from "zod";

export type BuildResultWithMeta = BuildIncremental & { metafile: Metafile };

interface PackageSettings {
    /**
     * Specifies type of instrument.
     * - `React` instruments will be created with a `BaseInstrument` harness that exposes an `MSFS_REACT_MOUNT` element for mounting.
     * - `BaseInstrument` instruments must specify the `instrumentId` and `mountElementId` to match the instrument configuration.
     */
    type: string;
    /** Final template filename. Defaults to `instrument`. */
    fileName?: string;
    /** Simulator packages to import in the HTML template. */
    imports?: string[];
}

interface ReactInstrumentPackageSettings extends PackageSettings {
    type: "react";
    /** Optional parameter to specify template ID. Defaults to `Instrument.name`. */
    templateId?: string;
    /** Whether the instrument is interactive or not. Defaults to `true`. */
    isInteractive?: boolean;
}

interface BaseInstrumentPackageSettings extends PackageSettings {
    type: "baseInstrument";
    /**
     * Required for `BaseInstrument` instruments.
     * This value must match the return value from the `BaseInstrument.templateID()` function.
     * */
    templateId: string;
    /**
     * Required for `BaseInstrument` instruments.
     * This value must match the ID in your call to `FSComponent.render()`..
     */
    mountElementId: string;
}

export interface Instrument {
    /** Instrument name, used as directory name for bundles and packages. */
    name: string;
    /** Entrypoint filename for instrument. */
    index: string;

    /** When passed a configuration object, enables a simulator package export. */
    simulatorPackage?: ReactInstrumentPackageSettings | BaseInstrumentPackageSettings;

    /** Instruments to import as ESM modules. */
    modules?: Instrument[];
    /** (Required for instruments included as `modules`) Import name to resolve to the bundled module. */
    resolve?: string;

    /** esbuild plugins to include for only this instrument (<https://github.com/esbuild/community-plugins>) */
    plugins?: Plugin[];
}

export interface MachConfig {
    /** Name of package, used for bundling simulator packages. */
    packageName: string;
    /** Path to directory containing `html_ui`. */
    packageDir: string;
    /** esbuild plugins to include for all instruments (<https://github.com/esbuild/community-plugins>) */
    plugins?: Plugin[];
    /** All instruments to be bundled by Mach. */
    instruments: Instrument[];
}

export const PluginSchema: z.ZodType<Plugin> = z.object({
    name: z.string(),
    setup: z
        .function()
        .args(z.any())
        .returns(z.union([z.void(), z.promise(z.void())])),
});

export const InstrumentSchema: z.ZodType<Instrument> = z.lazy(() =>
    z.object({
        name: z.string(),
        index: z.string(),

        simulatorPackage: z
            .union([
                z.object({
                    type: z.literal("react"),
                    fileName: z.string().optional(),
                    templateName: z.string().optional(),
                    imports: z.array(z.string()).optional(),
                    templateId: z.string().optional(),
                    isInteractive: z.boolean().optional(),
                }),
                z.object({
                    type: z.literal("baseInstrument"),
                    fileName: z.string().optional(),
                    templateName: z.string().optional(),
                    imports: z.array(z.string()).optional(),
                    templateId: z.string(),
                    mountElementId: z.string(),
                }),
            ])
            .optional(),

        modules: z.array(InstrumentSchema).optional(),
        resolve: z.string().optional(),

        plugins: z.array(PluginSchema).optional(),
    }),
);

export const MachConfigSchema = z.object({
    packageName: z.string(),
    packageDir: z.string(),
    plugins: z.array(PluginSchema).optional(),
    instruments: z.array(InstrumentSchema),
});

const ESBUILD_WARNINGS = [
    "assign-to-constant",
    "assign-to-import",
    "call-import-namespace",
    "commonjs-variable-in-esm",
    "delete-super-property",
    "duplicate-case",
    "duplicate-object-key",
    "empty-import-meta",
    "equals-nan",
    "equals-negative-zero",
    "equals-new-object",
    "html-comment-in-js",
    "impossible-typeof",
    "private-name-will-throw",
    "semicolon-after-return",
    "suspicious-boolean-not",
    "this-is-undefined-in-esm",
    "unsupported-dynamic-import",
    "unsupported-jsx-comment",
    "unsupported-regexp",
    "unsupported-require-call",
    "css-syntax-error",
    "invalid-@charset",
    "invalid-@import",
    "invalid-@nest",
    "invalid-@layer",
    "invalid-calc",
    "js-comment-in-css",
    "unsupported-@charset",
    "unsupported-@namespace",
    "unsupported-css-property",
    "ambiguous-reexport",
    "different-path-case",
    "ignored-bare-import",
    "ignored-dynamic-import",
    "import-is-undefined",
    "require-resolve-not-external",
    "invalid-source-mappings",
    "sections-in-source-map",
    "missing-source-map",
    "unsupported-source-map-comment",
    "package.json",
    "tsconfig.json",
];

export const ESBUILD_ERRORS: Record<string, LogLevel> = Object.fromEntries(
    ESBUILD_WARNINGS.map((warning) => [warning, "error"]),
);
