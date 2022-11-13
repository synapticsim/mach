/*
 * SPDX-FileCopyrightText: 2022 Synaptic Simulations and its contributors
 * SPDX-License-Identifier: MIT
 */

import { Plugin } from 'esbuild';
import path from 'path';
import fs from 'fs/promises';
import { renderFile } from 'template-file';
import { BuildLogger } from './logger';
import { Instrument } from './types';

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
export const writePackageSources = (logger: BuildLogger, instrument: Instrument): Plugin => ({
    name: 'writePackageSources',
    setup(build) {
        build.onEnd(async (result) => {
            if (instrument.simulatorPackage && result.errors.length === 0) {
                const jsPath = path.join(path.dirname(build.initialOptions.outfile!), 'bundle.js');
                const cssPath = path.join(path.dirname(build.initialOptions.outfile!), 'bundle.css');

                const js = await fs.readFile(jsPath, { encoding: 'utf-8' });
                const css = await fs.readFile(cssPath, { encoding: 'utf-8' });

                const packageTarget = path.join(process.env.PACKAGE_DIR, 'html_ui/Pages/VCockpit/Instruments', process.env.PACKAGE_NAME, instrument.name);
                await fs.mkdir(packageTarget, { recursive: true });

                const packagePath = path.join('/Pages/VCockpit/Instruments', process.env.PACKAGE_NAME, instrument.name);
                const fileName = instrument.simulatorPackage.fileName ?? 'template';
                const templateId = instrument.simulatorPackage.templateId ?? instrument.name;

                await fs.writeFile(path.join(packageTarget, `${fileName}.css`), css);
                await fs.writeFile(
                    path.join(packageTarget, `${fileName}.js`),
                    instrument.simulatorPackage.type === 'react'
                        ? await renderFile(path.join(__dirname, './templates/reactTemplate.cjs'), {
                            templateId,
                            jsBundle: js,
                            instrumentName: `${process.env.PACKAGE_NAME.toLowerCase()}-${templateId.toLowerCase()}`,
                        })
                        : js,
                );
                await fs.writeFile(
                    path.join(packageTarget, `${fileName}.html`),
                    await renderFile(path.join(__dirname, './templates/template.html'), {
                        templateId,
                        mountElementId: instrument.simulatorPackage.type === 'react'
                            ? 'MSFS_REACT_MOUNT'
                            : instrument.simulatorPackage.mountElementId,
                        imports: instrument.simulatorPackage.imports ?? [],
                        cssPath: path.join(packagePath, `${fileName}.css`).replace(/\\/g, '/'),
                        jsPath: path.join(packagePath, `${fileName}.js`).replace(/\\/g, '/'),
                    }),
                );
            }
        });
    },
});
