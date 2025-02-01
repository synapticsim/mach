#! /usr/bin/env node

/*
 * SPDX-FileCopyrightText: 2022 Synaptic Simulations and its contributors
 * SPDX-License-Identifier: MIT
 */

import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import dotenv from "dotenv";
// @ts-ignore FIXME: remove the ignore when/if https://github.com/antitoxic/import-single-ts/pull/7 is merged
import { importSingleTs } from "import-single-ts";
import signale from "signale";
import { fromError } from "zod-validation-error";

import { description, version } from "./package.json";
import { machBuild, machWatch } from "./src/mach";
import { type MachArgs, MachArgsSchema, MachConfigSchema } from "./src/types";

const CONFIG_FILENAMES = ["mach.config.js", "mach.config.ts"];

try {
    dotenv.config();
} catch {
    // .env is optional, but dotenv throws an error if it cannot load it
}

const cli = new Command();

const logger = new signale.Signale({
    types: {
        error: { badge: "×", label: "error", color: "red", stream: process.stderr },
    },
});

const commandWithOptions = (name: string) =>
    cli
        .command(name)
        .option("-c, --config <filename>", "specify path to configuration file")
        .option("-d, --work-in-config-dir", "use config directory as working directory")
        .option("-b, --bundles <dirname>", "bundles output directory", "./bundles")
        .option("-e, --werror", "makes all warnings into errors")
        .option("-f, --filter <regex>", "regex filter of included instrument names")
        .option("-m, --minify", "minify bundle code")
        .option("-s, --skip-simulator-package", "skips writing simulator package templates")
        .option("-t, --output-metafile", "output `build_meta.json` file to bundles directory")
        .option("-u, --output-sourcemaps", "append sourcemaps to the end of bundle files")
        .option("-v, --verbose", "output additional build information")
        .hook("preAction", async (_thisCommand, actionCommand) => {
            signale.info(`Welcome to ${chalk.cyanBright("Mach")}, v${version}`);

            const filter = actionCommand.getOptionValue("filter");
            if (filter) {
                actionCommand.setOptionValue("filter", new RegExp(filter));
            }

            // Load config

            let config = actionCommand.getOptionValue("config") ?? CONFIG_FILENAMES.find((file) => fs.existsSync(file));
            if (!config) {
                signale.error("Configuration file not found, consider using `-c` or `--config` to specify the path");
                process.exit(1);
            }

            config = path.resolve(config).replace(/\\/g, "/");
            // FIXME: remove the type cast when/if https://github.com/antitoxic/import-single-ts/pull/7 is merged
            await (config.endsWith(".ts") ? (importSingleTs(config) as Promise<never>) : import(config))
                .then((module) => {
                    // Check config integrity
                    const result = MachConfigSchema.safeParse(module.default);
                    if (result.success) {
                        actionCommand.setOptionValue("config", result.data);
                    } else {
                        logger.error("Invalid config file", chalk.redBright(config));
                        logger.error(chalk.white(fromError(result.error)));
                        process.exit(1);
                    }

                    logger.info("Loaded config file", chalk.cyanBright(config), "\n");

                    if (actionCommand.getOptionValue("workInConfigDir")) {
                        process.chdir(path.dirname(config));
                    }
                })
                .catch((error) => {
                    logger.error("Unable to load config file", chalk.redBright(config));
                    logger.error(error);
                    process.exit(1);
                });
        });

cli.name("mach").version(version).description(description);

commandWithOptions("build")
    .description("compile instruments specified in configuration file")
    .action((args: MachArgs) => {
        const parsedArgs = MachArgsSchema.parse(args);
        const numInstruments = parsedArgs.config.instruments.length;

        signale.start(`Building ${numInstruments} instruments\n`);

        const startTime = performance.now();
        machBuild(parsedArgs).then((results) => {
            const stopTime = performance.now();
            const numSuccess = results.filter(({ status }) => status === "fulfilled").length;

            if (numSuccess > 0) {
                signale.success(
                    `Built ${numSuccess} instruments in`,
                    chalk.greenBright(`${(stopTime - startTime).toFixed()} ms`),
                    "\n",
                );
            } else {
                signale.error(`All ${numInstruments} instruments failed to build`);
            }

            if (numSuccess < numInstruments) {
                process.exit(1);
            }
        });
    });

commandWithOptions("watch")
    .description("watch instruments for changes and re-compile bundles when updated")
    .action((args: MachArgs) => {
        machWatch(MachArgsSchema.parse(args)).then((results) => {
            if (results.some(({ status }) => status === "rejected")) {
                signale.error("Watch mode requires a build-able bundle to initialize");
                process.exit(1);
            }

            signale.watch("Watching for changes\n");
        });
    });

cli.parse();

export { machBuild, machWatch } from "./src/mach";
export * from "./src/types";
