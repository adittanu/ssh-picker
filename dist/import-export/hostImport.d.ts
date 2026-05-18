import type { VaultContext } from '../shared/types.js';
export interface ImportResult {
    imported: number;
    skipped: number;
}
export declare function importOpenSshConfig(file: string, vault: VaultContext): ImportResult;
export declare function importTermiusCsv(file: string, vault: VaultContext): ImportResult;
