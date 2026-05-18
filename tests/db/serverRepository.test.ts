import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openMigratedDatabase } from '../../src/db/connection.js';
import { ServerRepository } from '../../src/db/repositories/serverRepository.js';

let dirs: string[] = [];
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'sshp-repo-'));
  dirs.push(dir);
  const db = openMigratedDatabase(join(dir, 'sshp.db'));
  return { db, repo: new ServerRepository(db) };
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

describe('server repository', () => {
  it('creates, lists, updates, records history, and removes servers', () => {
    const { db, repo } = makeRepo();
    const created = repo.create({ name: 'dev', host: 'example.com', port: 22, username: 'ubuntu', authType: 'password', encryptedPassword: '{}' });
    expect(created.id).toBeGreaterThan(0);
    expect(repo.list()).toHaveLength(1);
    expect(repo.findByName('dev').host).toBe('example.com');
    expect(repo.update(created.id, { host: '127.0.0.1' }).host).toBe('127.0.0.1');
    repo.recordConnection(created.id, 'ssh');
    expect(repo.findById(created.id).connectionCount).toBe(1);
    repo.remove(created.id);
    expect(repo.list()).toHaveLength(0);
    db.close();
  });
});
