import type { Database } from './connection.js';
export declare const CURRENT_SCHEMA_VERSION = 1;
export declare function runMigrations(db: Database): void;
export declare function getSchemaVersion(db: Database): number;
