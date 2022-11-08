declare global {
    namespace NodeJS {
        interface ProcessEnv {
            CONFIG_PATH: string;
            BUNDLES_DIR: string;
            PACKAGES_DIR: string;
            OUTPUT_METAFILE: boolean;
        }
    }
}

export {};
