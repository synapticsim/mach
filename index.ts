#! /usr/bin/env node

/*
 * SPDX-FileCopyrightText: 2022 Synaptic Simulations and its contributors
 * SPDX-License-Identifier: MIT
 */

import dotenv from 'dotenv';
import { Command } from 'commander';
import signale from 'signale';
import chalk from 'chalk';
import path from 'path';
import { description, version } from './package.json';
import { machBuild, machWatch } from './src';
import { MachConfig, MachConfigSchema } from './src/types';

try {
    dotenv.config();
} catch {
    // .env is optional, but dotenv throws an error if it cannot load it
}

interface ParsedCommandArgs {
    config: MachConfig;
    bundles: string;
    out: string;
    filter?: RegExp;
    verbose?: boolean;
    outputMetafile?: boolean;
    skipSimulatorPackage?: boolean;
}

const cli = new Command();

const commandWithOptions = (name: string) => cli.command(name)
    .option('-c, --config <filename>', 'specify path to configuration file', './mach.config.js')
    .option('-d, --work-in-config-dir', 'use config directory as working directory')
    .option('-b, --bundles <dirname>', 'bundles output directory', './bundles')
    .option('-e, --werror', 'makes all warnings into errors')
    .option('-f, --filter <regex>', 'regex filter of included instrument names')
    .option('-m, --minify', 'minify bundle code')
    .option('-s, --skip-simulator-package', 'skips writing simulator package templates')
    .option('-t, --output-metafile', 'output `build_meta.json` file to bundles directory')
    .option('-u, --output-sourcemaps', 'append sourcemaps to the end of bundle files')
    .option('-v, --verbose', 'output additional build information')
    .hook('preAction', async (thisCommand, actionCommand) => {
        signale.info(`Welcome to ${chalk.cyanBright('Mach')}, v${version}`);

        process.env.CONFIG_PATH = path.resolve(actionCommand.getOptionValue('config'));
        process.env.BUNDLES_DIR = path.resolve(actionCommand.getOptionValue('bundles'));
        process.env.WARNINGS_ERROR = actionCommand.getOptionValue('werror') ?? false;
        process.env.MINIFY_BUNDLES = actionCommand.getOptionValue('minify') ?? false;
        process.env.SKIP_SIM_PACKAGE = actionCommand.getOptionValue('skipSimulatorPackage') ?? false;
        process.env.VERBOSE_OUTPUT = actionCommand.getOptionValue('verbose') ?? false;
        process.env.OUTPUT_METAFILE = actionCommand.getOptionValue('outputMetafile') ?? false;
        process.env.OUTPUT_SOURCEMAPS = actionCommand.getOptionValue('outputSourcemaps') ?? false;
        process.env.WORK_IN_CONFIG_DIR = actionCommand.getOptionValue('workInConfigDir') ?? false;

        actionCommand.setOptionValue('filter', new RegExp(actionCommand.getOptionValue('filter')));

        // Load config
        await import(process.env.CONFIG_PATH.replace(/\\/g, '/'))
            .then((module) => {
                // Check config integrity
                const result = MachConfigSchema.safeParse(module.default);
                if (result.success) {
                    actionCommand.setOptionValue('config', result.data);
                    signale.info('Loaded config file', chalk.cyanBright(process.env.CONFIG_PATH), '\n');
                } else {
                    signale.error('Invalid config file', chalk.redBright(process.env.CONFIG_PATH));
                    process.exit(1);
                }

                if (process.env.WORK_IN_CONFIG_DIR) {
                    process.chdir(path.dirname(process.env.CONFIG_PATH));
                }
            })
            .catch(() => {
                signale.error('Unable to load config file', chalk.redBright(process.env.CONFIG_PATH));
                process.exit(1);
            });
    });

cli
    .name('mach')
    .version(version)
    .description(description);

commandWithOptions('build')
    .description('compile instruments specified in configuration file')
    .action(({ config, filter }: ParsedCommandArgs) => machBuild(config, filter));

commandWithOptions('watch')
    .description('watch instruments for changes and re-compile bundles when updated')
    .action(({ config, filter }: ParsedCommandArgs) => machWatch(config, filter));

cli.parse();

export { machBuild, machWatch } from './src';
export * from './src/types';
