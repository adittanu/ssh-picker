import type { VaultContext } from '../shared/types.js';
export declare function exportVault(outFile: string, vault: VaultContext): string;
export declare function importVault(inFile: string, masterPassword: string, dataDir?: string): string;
export declare function copyVaultDataDir(sourceDbPath: string, dataDir?: string): string;
