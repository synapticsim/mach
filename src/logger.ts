/*
 * SPDX-FileCopyrightText: 2022 Synaptic Simulations and its contributors
 * SPDX-License-Identifier: MIT
 */

/* eslint no-console: 0 */
import signale, { DefaultMethods, Signale } from 'signale';
import { filesize } from 'filesize';
import { Message } from 'esbuild';
import chalk from 'chalk';
import path from 'path';
import { BuildResultWithMeta } from './types';

export class BuildLogger {
    private readonly logger: Signale<DefaultMethods | 'file' | 'errorMessage' | 'errorLocation'>;

    constructor(scope: string) {
        this.logger = new signale.Signale({
            scope,
            types: {
                file: { badge: ' ', label: 'file', color: 'blue', logLevel: 'info' },
                errorMessage: { badge: '', label: '', color: 'white', logLevel: 'error' },
                errorLocation: { badge: '→', label: '', color: 'white', logLevel: 'error' },
                warningMessage: { badge: '', label: '', color: 'white', logLevel: 'warning' },
                warningLocation: { badge: '→', label: '', color: 'white', logLevel: 'warning' },
            },
        });
    }

    buildComplete(name: string, time: number, result: BuildResultWithMeta) {
        if (result.warnings.length > 0) {
            this.logger.warn(
                `Built ${name} in ${chalk.yellowBright((time).toFixed(), 'ms')} —`,
                chalk.yellowBright(`${result.warnings.length} ${result.warnings.length === 1 ? 'warning' : 'warnings'}`),
            );
        } else {
            this.logger.success(`Built ${name} in ${chalk.greenBright((time).toFixed(), 'ms')}`);
        }
        for (const [file, meta] of Object.entries(result.metafile.outputs)) {
            this.logger.file(chalk.gray(`${file} — ${chalk.cyan(filesize(meta.bytes))}`));
        }
        console.log();
        if (result.warnings.length > 0) {
            for (const warning of result.warnings) {
                this.logger.errorMessage(chalk.yellowBright(warning.text));
                this.logger.errorLocation(`at ${warning.location?.file}:${warning.location?.line}:${warning.location?.column}\n`);
            }
        }
    }

    buildFailed(errors: Message[]) {
        this.logger.error(`Build failed — ${chalk.redBright(errors.length, errors.length === 1 ? 'error' : 'errors')}\n`);
        for (const error of errors) {
            this.logger.errorMessage(chalk.redBright(error.text));
            this.logger.errorLocation(`at ${error.location?.file}:${error.location?.line}:${error.location?.column}\n`);
        }
    }

    changeDetected(file: string) {
        console.clear();
        signale.watch(`Change detected in ${path.relative(process.cwd(), file)}, rebuilding\n`);
    }
}
