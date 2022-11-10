/*
 * SPDX-FileCopyrightText: 2022 Synaptic Simulations and its contributors
 * SPDX-License-Identifier: MIT
 */

import { Plugin } from 'esbuild';
import path from 'path';
import fs from 'fs/promises';
import { BuildLogger } from './logger';
import { htmlTemplate, jsTemplate } from './templates';

/**
 * Override module resolution of specified imports.
 */
export const resolve = (options: { [module: string]: string}): Plugin => ({
    name: 'resolve',
    setup(build) {
        build.onResolve(
            { filter: new RegExp(`^(${Object.keys(options).join('|')})$`) },
            (args) => ({ path: options[args.path] }),
        );
    },
});

/**
 * Include specified CSS bundles in main bundle.
 */
export const includeCSS = (modules: string[]): Plugin => ({
    name: 'includeCSS',
    setup(build) {
        build.onEnd(() => {
            const cssPath = path.join(path.dirname(build.initialOptions.outfile!), 'bundle.css');
            modules.map(async (mod) => {
                const css = await fs.readFile(mod);
                await fs.appendFile(cssPath, css);
            });
        });
    },
});

/**
 * Write `build_meta.json` files containing build data into the bundle directory.
 */
export const writeMetafile: Plugin = {
    name: 'writeMetafile',
    setup(build) {
        build.onEnd((result) => {
            if (result.errors.length === 0) {
                fs.writeFile(
                    path.join(path.dirname(build.initialOptions.outfile!), 'build_meta.json'),
                    JSON.stringify(result.metafile),
                );
            }
        });
    },
};

/**
 * Export simulator packages to `PackageSources` directory
 */
export const writePackageSources = (logger: BuildLogger, instrumentName: string, imports: string[] = [], isInteractive = true): Plugin => ({
    name: 'writePackageSources',
    setup(build) {
        build.onEnd(async (result) => {
            if (result.errors.length === 0) {
                const jsPath = path.join(path.dirname(build.initialOptions.outfile!), 'bundle.js');
                const cssPath = path.join(path.dirname(build.initialOptions.outfile!), 'bundle.css');

                const js = await fs.readFile(jsPath, { encoding: 'utf-8' });
                const css = await fs.readFile(cssPath, { encoding: 'utf-8' });

                const packageTarget = path.join(process.env.PACKAGE_DIR, 'html_ui/Pages/VCockpit/Instruments', process.env.PACKAGE_NAME, instrumentName);
                await fs.mkdir(packageTarget, { recursive: true });

                await fs.writeFile(path.join(packageTarget, 'template.html'), htmlTemplate(instrumentName, imports, js, css));
                await fs.writeFile(path.join(packageTarget, 'template.js'), jsTemplate(instrumentName, isInteractive));
            }
        });
    },
});
