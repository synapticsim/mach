#! /usr/bin/env node
import { Command } from 'commander';
import signale from 'signale';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { description, version } from './package.json';
import { machBuild, machWatch } from './src';
import { MachConfigSchema, ParsedCommandArgs } from './src/types';

const cli = new Command();

const commandWithOptions = (name: string) => cli.command(name)
    .option('-c, --config <filename>', 'specify path to configuration file', './mach.config.json')
    .option('-b, --bundles <directory>', 'bundles output directory', './bundles')
    .option('-f, --filter <regex>', 'regex filter of included instrument names')
    .option('--output-metafile', 'output `build_meta.json` file to bundles directory')
    .hook('preAction', async (thisCommand, actionCommand) => {
        signale.info(`Welcome to ${chalk.cyanBright('Mach')}, v${version}`);

        process.env.CONFIG_PATH = path.join(process.cwd(), actionCommand.getOptionValue('config'));
        process.env.BUNDLES_DIR = path.join(process.cwd(), actionCommand.getOptionValue('bundles'));
        process.env.OUTPUT_METAFILE = actionCommand.getOptionValue('outputMetafile');

        actionCommand.setOptionValue('filter', new RegExp(actionCommand.getOptionValue('filter')));

        // Load config
        const rawConf = await fs.readFile(process.env.CONFIG_PATH, { encoding: 'utf-8' })
            .then((res) => res)
            .catch(() => {
                signale.error('Failed to read config file', chalk.redBright(process.env.CONFIG_PATH));
                process.exit(1);
            });

        // Parse and check config integrity
        try {
            const conf = MachConfigSchema.parse(JSON.parse(rawConf));
            // Overwrite config with parsed data
            actionCommand.setOptionValue('config', conf);
            signale.info('Loaded config file', chalk.cyanBright(process.env.CONFIG_PATH), '\n');
        } catch (error) {
            signale.error('Invalid config file', chalk.redBright(process.env.CONFIG_PATH));
            process.exit(1);
        }
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
