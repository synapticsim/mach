declare global {
    namespace NodeJS {
        interface ProcessEnv {
            CONFIG_PATH: string;
            BUNDLES_DIR: string;
            PACKAGES_DIR: string;
            PACKAGE_NAME: string;
            OUTPUT_METAFILE: boolean;
        }
    }
}

export {};
