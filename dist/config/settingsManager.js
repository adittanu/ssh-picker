import { SettingsRepository } from '../db/repositories/settingsRepository.js';
import { DEFAULT_SETTINGS } from './settings.js';
/**
 * Load all app settings from the database, falling back to defaults.
 */
export function loadSettings(db) {
    const repo = new SettingsRepository(db);
    const settings = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
        const raw = repo.get(`app.${key}`);
        if (raw === null)
            continue;
        const def = DEFAULT_SETTINGS[key];
        if (typeof def === 'boolean') {
            settings[key] = raw === 'true';
        }
        else if (typeof def === 'number') {
            settings[key] = Number(raw) || def;
        }
        else {
            settings[key] = raw;
        }
    }
    return settings;
}
/**
 * Save a single setting to the database.
 */
export function saveSetting(db, key, value) {
    const repo = new SettingsRepository(db);
    repo.set(`app.${key}`, String(value));
}
/**
 * Reset all settings to defaults.
 */
export function resetSettings(db) {
    const repo = new SettingsRepository(db);
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
        repo.delete(`app.${key}`);
    }
}
//# sourceMappingURL=settingsManager.js.map