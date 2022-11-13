/*
 * SPDX-FileCopyrightText: 2022 Synaptic Simulations and its contributors
 * SPDX-License-Identifier: MIT
 */

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            PACKAGE_DIR: string;
            PACKAGE_NAME: string;
            SKIP_SIM_PACKAGE: string;
            WARNINGS_ERROR: string;
            CONFIG_PATH: string;
            BUNDLES_DIR: string;
            VERBOSE_OUTPUT: string;
            OUTPUT_METAFILE: string;
        }
    }
}

export {};
