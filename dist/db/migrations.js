export const CURRENT_SCHEMA_VERSION = 1;
export function runMigrations(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 22,
      username TEXT NOT NULL,
      auth_type TEXT NOT NULL,
      encrypted_password TEXT,
      encrypted_private_key TEXT,
      encrypted_passphrase TEXT,
      tags TEXT,
      notes TEXT,
      default_remote_path TEXT,
      last_connected_at TEXT,
      connection_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS connection_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      local_path TEXT,
      remote_path TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    PRAGMA user_version = ${CURRENT_SCHEMA_VERSION};
  `);
}
export function getSchemaVersion(db) {
    const row = db.prepare('PRAGMA user_version').get();
    return row?.user_version ?? 0;
}
//# sourceMappingURL=migrations.js.map