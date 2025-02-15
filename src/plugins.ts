/*
 * SPDX-FileCopyrightText: 2022 Synaptic Simulations and its contributors
 * SPDX-License-Identifier: MIT
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { Loader, Message, OnLoadArgs, Plugin } from "esbuild";
import { renderFile } from "template-file";

import type { Instrument, MachArgs } from "./types";

const ENV_REGEX = /process\.env\.(?<variable>[A-Za-z0-9_]+)/gm;

/**
 * Replace references to `process.env.*` with their value from the current environment.
 */
export const environment: Plugin = {
    name: "mach-environment",
    setup(build) {
        const loader = (loader: Loader) => async (args: OnLoadArgs) => {
            let contents = await fs.readFile(args.path, "utf8");
            if (args.path.includes("node_modules")) {
                return { contents, loader };
            }

            let indexOffset = 0;

            // The contents are split on newlines for the purposes of warning creation only
            // This is done lazily to avoid unnecessary excessive string ops when there are no warnings
            let lines: string[] | null = null;
            const warnings: Partial<Message>[] = [];

            for (const match of contents.matchAll(ENV_REGEX)) {
                if (match.groups === undefined || match.index === undefined) {
                    continue;
                }

                const index = match.index + indexOffset;
                const value = process.env[match.groups.variable] ?? null;
                if (value === null) {
                    if (lines === null) {
                        lines = contents.split("\n");
                    }

                    let line = 0;
                    let column = match.index;

                    while (column >= lines[line].length) {
                        // The extra one accounts for the newline that would be there
                        column -= lines[line].length + 1;
                        line += 1;
                    }

                    warnings.push({
                        text: `${match[0]} is not defined`,
                        location: {
                            file: args.path,
                            namespace: args.namespace,
                            line: line + 1,
                            column,
                            length: match[0].length,
                            lineText: lines[line],
                            suggestion: "",
                        },
                    });
                }

                const stringified =
                    value === "true" ||
                    value === "false" ||
                    // biome-ignore lint/suspicious/noGlobalIsNan: we actually want the type coercion here
                    (value !== null && value !== "" && !isNaN(value as unknown as number))
                        ? value
                        : JSON.stringify(value);

                contents = contents.slice(0, index) + stringified + contents.slice(index + match[0].length);
                indexOffset += stringified.length - match[0].length;
            }

            return { contents, loader, warnings };
        };

        build.onLoad({ filter: /\.ts$/ }, loader("ts"));
        build.onLoad({ filter: /\.tsx$/ }, loader("tsx"));
        build.onLoad({ filter: /\.js$/ }, loader("js"));
        build.onLoad({ filter: /\.jsx$/ }, loader("jsx"));
    },
};

/**
 * Write `build_meta.json` files containing build data into the bundle directory.
 */
export const writeMetafile: Plugin = {
    name: "mach-write-metafile",
    setup(build) {
        build.onEnd((result) => {
            if (result.errors.length === 0) {
                fs.writeFile(
                    path.join(path.dirname(build.initialOptions.outfile!), "build_meta.json"),
                    JSON.stringify(result.metafile),
                );
            }
        });
    },
};

/**
 * Export simulator packages to `PackageSources` directory
 */
export const writePackageSources = (args: MachArgs, instrument: Instrument): Plugin => ({
    name: "mach-write-package-sources",
    setup(build) {
        build.onEnd(async (result) => {
            if (instrument.simulatorPackage && result.errors.length === 0) {
                const jsBundlePath = path.join(path.dirname(build.initialOptions.outfile!), "bundle.js");
                const cssBundlePath = path.join(path.dirname(build.initialOptions.outfile!), "bundle.css");

                const js = await fs.readFile(jsBundlePath, { encoding: "utf-8" });
                const css = await fs.readFile(cssBundlePath, { encoding: "utf-8" });

                const htmlUiPath = path.join(process.cwd(), args.config.packageDir, "html_ui");
                const packageTarget = path.join(
                    htmlUiPath,
                    "Pages/VCockpit/Instruments",
                    args.config.packageName,
                    instrument.name,
                );
                await fs.mkdir(packageTarget, { recursive: true });

                const fileName = instrument.simulatorPackage.fileName ?? "instrument";
                const templateId = instrument.simulatorPackage.templateId ?? instrument.name;

                const cssPath = path.join(packageTarget, `${fileName}.css`);
                const jsPath = path.join(packageTarget, `${fileName}.js`);
                const instrumentPath =
                    instrument.simulatorPackage.type === "react"
                        ? path.join(packageTarget, `${fileName}.index.js`)
                        : jsPath;

                const templateParams = {
                    templateId,
                    instrumentName: `${args.config.packageName.toLowerCase()}-${templateId.toLowerCase()}`,
                    mountElementId:
                        instrument.simulatorPackage.type === "react"
                            ? "MSFS_REACT_MOUNT"
                            : instrument.simulatorPackage.mountElementId,
                    imports: instrument.simulatorPackage.imports ?? [],
                    cssPath: cssPath.replace(htmlUiPath, "").replace(/\\/g, "/"),
                    jsPath: jsPath.replace(htmlUiPath, "").replace(/\\/g, "/"),
                    instrumentPath: instrumentPath.replace(htmlUiPath, "").replace(/\\/g, "/"),
                };

                await fs.writeFile(cssPath, css);
                await fs.writeFile(jsPath, js);

                if (instrument.simulatorPackage.type === "react") {
                    await fs.writeFile(
                        instrumentPath,
                        await renderFile(path.join(__dirname, "./templates/instrument.cjs"), templateParams),
                    );
                }

                await fs.writeFile(
                    path.join(packageTarget, `${fileName}.html`),
                    await renderFile(path.join(__dirname, "./templates/index.html"), templateParams),
                );
            }
        });
    },
});
