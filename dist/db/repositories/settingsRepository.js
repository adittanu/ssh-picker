export class SettingsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    get(key) {
        const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        return row?.value ?? null;
    }
    set(key, value) {
        this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
    }
    delete(key) {
        this.db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    }
}
//# sourceMappingURL=settingsRepository.js.map