import type { Database } from '../db/connection.js';
import { SettingsRepository } from '../db/repositories/settingsRepository.js';
import { DEFAULT_SETTINGS, type AppSettings, type SettingKey } from './settings.js';

/**
 * Load all app settings from the database, falling back to defaults.
 */
export function loadSettings(db: Database): AppSettings {
  const repo = new SettingsRepository(db);
  const settings = { ...DEFAULT_SETTINGS };

  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
    const raw = repo.get(`app.${key}`);
    if (raw === null) continue;
    const def = DEFAULT_SETTINGS[key];
    if (typeof def === 'boolean') {
      (settings as Record<string, unknown>)[key] = raw === 'true';
    } else if (typeof def === 'number') {
      (settings as Record<string, unknown>)[key] = Number(raw) || def;
    } else {
      (settings as Record<string, unknown>)[key] = raw;
    }
  }

  return settings;
}

/**
 * Save a single setting to the database.
 */
export function saveSetting(db: Database, key: SettingKey, value: string | number | boolean): void {
  const repo = new SettingsRepository(db);
  repo.set(`app.${key}`, String(value));
}

/**
 * Reset all settings to defaults.
 */
export function resetSettings(db: Database): void {
  const repo = new SettingsRepository(db);
  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
    repo.delete(`app.${key}`);
  }
}
