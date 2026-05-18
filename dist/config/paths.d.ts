export declare const APP_DIR_NAME = ".sshp";
export declare const DB_FILE_NAME = "sshp.db";
export declare const CONFIG_FILE_NAME = "config.json";
export interface PathResolutionOptions {
    env?: NodeJS.ProcessEnv;
    home?: string;
}
export interface BootstrapConfig {
    dataDir?: string;
}
export declare function defaultDataDir(home?: string): string;
export declare function bootstrapConfigPath(home?: string): string;
export declare function readBootstrapConfig(home?: string): BootstrapConfig;
export declare function writeBootstrapConfig(config: BootstrapConfig, home?: string): void;
export declare function resolveDataDir(options?: PathResolutionOptions): string;
export declare function resolveDbPath(dataDir?: string): string;
export declare function ensureDataDir(dataDir?: string): string;
