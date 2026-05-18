import type { Database } from '../connection.js';
export declare class SettingsRepository {
    private readonly db;
    constructor(db: Database);
    get(key: string): string | null;
    set(key: string, value: string): void;
    delete(key: string): void;
}
