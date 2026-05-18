import { DatabaseSync } from 'node:sqlite';
export type Database = InstanceType<typeof DatabaseSync>;
export declare function openDatabase(dbPath?: string): Database;
export declare function openMigratedDatabase(dbPath?: string): Database;
