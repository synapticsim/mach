/*
 * SPDX-FileCopyrightText: 2022 Synaptic Simulations and its contributors
 * SPDX-License-Identifier: MIT
 */

import path from "node:path";
import chalk from "chalk";
import type { Message } from "esbuild";
import { filesize } from "filesize";
import signale, { type DefaultMethods, type Signale } from "signale";

import type { BuildResultWithMeta } from "./types";

export class BuildLogger {
    private readonly logger: Signale<
        DefaultMethods | "file" | "errorMessage" | "errorLocation" | "warningMessage" | "warningLocation"
    >;

    private readonly verbose: boolean;

    constructor(scope: string, verbose = false) {
        this.logger = new signale.Signale({
            scope,
            types: {
                file: { badge: " ", label: "file", color: "blue", logLevel: "info" },
                errorMessage: { badge: "", label: "", color: "white", logLevel: "error", stream: process.stderr },
                errorLocation: { badge: "→", label: "", color: "white", logLevel: "error", stream: process.stderr },
                warningMessage: { badge: "", label: "", color: "white", logLevel: "warning", stream: process.stderr },
                warningLocation: { badge: "→", label: "", color: "white", logLevel: "warning", stream: process.stderr },
            },
        });
        this.verbose = verbose;
    }

    buildComplete(name: string, time: number, result: BuildResultWithMeta) {
        if (result.warnings.length > 0) {
            this.logger.warn(
                `Built ${name} in ${chalk.yellowBright(time.toFixed(), "ms")} —`,
                chalk.yellowBright(
                    `${result.warnings.length} ${result.warnings.length === 1 ? "warning" : "warnings"}`,
                ),
            );
        } else {
            this.logger.success(`Built ${name} in ${chalk.greenBright(time.toFixed(), "ms")}`);
        }
        if (this.verbose) {
            for (const [file, meta] of Object.entries(result.metafile.outputs)) {
                this.logger.file(chalk.gray(`${file} — ${chalk.cyan(filesize(meta.bytes))}`));
            }
        }
        console.log();
        if (result.warnings.length > 0) {
            for (const warning of result.warnings) {
                this.logger.errorMessage(
                    chalk.yellowBright(warning.id ? `${warning.text} (${warning.id})` : warning.text),
                );
                if (warning.notes.length > 0) {
                    // esbuild automatically attaches the message "The plugin x was triggered by this import",
                    // which is not very useful in our case
                    for (const note of warning.notes.filter(({ text }) => !text.startsWith("The plugin"))) {
                        this.logger.errorMessage(chalk.whiteBright(note.text));
                    }
                }
                if (warning.location) {
                    this.logger.errorLocation(
                        `at ${warning.location.file}:${warning.location.line}:${warning.location.column + 1}`,
                    );
                }
                console.log();
            }
        }
    }

    buildFailed(errors: Message[]) {
        this.logger.error(
            `Build failed — ${chalk.redBright(errors.length, errors.length === 1 ? "error" : "errors")}\n`,
        );
        for (const error of errors) {
            this.logger.errorMessage(chalk.redBright(error.id ? `${error.text} (${error.id})` : error.text));
            if (error.notes.length > 0) {
                for (const note of error.notes) {
                    this.logger.errorMessage(chalk.whiteBright(note.text));
                }
            }
            if (error.location) {
                this.logger.errorLocation(
                    `at ${error.location.file}:${error.location.line}:${error.location.column + 1}`,
                );
            }
            console.log();
        }
    }

    changeDetected(file: string) {
        console.clear();
        signale.watch(`Change detected in ${path.relative(process.cwd(), file)}, rebuilding\n`);
    }
}
