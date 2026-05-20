import type { Database } from '../db/connection.js';
import { type AppSettings, type SettingKey } from './settings.js';
/**
 * Load all app settings from the database, falling back to defaults.
 */
export declare function loadSettings(db: Database): AppSettings;
/**
 * Save a single setting to the database.
 */
export declare function saveSetting(db: Database, key: SettingKey, value: string | number | boolean): void;
/**
 * Reset all settings to defaults.
 */
export declare function resetSettings(db: Database): void;
