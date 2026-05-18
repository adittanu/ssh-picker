import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openMigratedDatabase } from '../../src/db/connection.js';
import { getSchemaVersion } from '../../src/db/migrations.js';

let dirs: string[] = [];
function tempDb() {
  const dir = mkdtempSync(join(tmpdir(), 'sshp-db-'));
  dirs.push(dir);
  return join(dir, 'sshp.db');
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

describe('migrations', () => {
  it('creates schema idempotently', () => {
    const path = tempDb();
    const db = openMigratedDatabase(path);
    expect(getSchemaVersion(db)).toBe(1);
    openMigratedDatabase(path).close();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[];
    expect(tables.map((row) => row.name)).toContain('servers');
    expect(tables.map((row) => row.name)).toContain('settings');
    expect(tables.map((row) => row.name)).toContain('connection_history');
    db.close();
  });
});
