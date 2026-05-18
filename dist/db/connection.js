import { DatabaseSync } from 'node:sqlite';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { resolveDbPath } from '../config/paths.js';
import { runMigrations } from './migrations.js';
export function openDatabase(dbPath = resolveDbPath()) {
    mkdirSync(dirname(dbPath), { recursive: true });
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    return db;
}
export function openMigratedDatabase(dbPath = resolveDbPath()) {
    const db = openDatabase(dbPath);
    runMigrations(db);
    return db;
}
//# sourceMappingURL=connection.js.map