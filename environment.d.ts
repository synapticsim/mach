/*
 * SPDX-FileCopyrightText: 2022 Synaptic Simulations and its contributors
 * SPDX-License-Identifier: MIT
 */

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            CONFIG_PATH: string;
            BUNDLES_DIR: string;
            OUTPUT_METAFILE: boolean;
            PACKAGE_DIR: string;
            PACKAGE_NAME: string;
        }
    }
}

export {};
