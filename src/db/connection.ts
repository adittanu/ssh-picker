import { DatabaseSync } from 'node:sqlite';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { resolveDbPath } from '../config/paths.js';
import { runMigrations } from './migrations.js';

export type Database = InstanceType<typeof DatabaseSync>;

export function openDatabase(dbPath = resolveDbPath()): Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  return db;
}

export function openMigratedDatabase(dbPath = resolveDbPath()): Database {
  const db = openDatabase(dbPath);
  runMigrations(db);
  return db;
}
