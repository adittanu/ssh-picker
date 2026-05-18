import { type Database } from '../db/connection.js';
import type { VaultContext } from '../shared/types.js';
export declare function vaultExists(dataDir?: string): boolean;
export declare function isVaultInitialized(db: Database): boolean;
export declare function initVault(masterPassword: string, dataDir?: string): VaultContext;
export declare function unlockVault(masterPassword: string, dataDir?: string): VaultContext;
export declare function openVaultDatabase(vault: VaultContext): Database;
