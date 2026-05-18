import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { importOpenSshConfig, importTermiusCsv } from '../../src/import-export/hostImport.js';
import { openMigratedDatabase } from '../../src/db/connection.js';
import { ServerRepository } from '../../src/db/repositories/serverRepository.js';
import { initVault } from '../../src/vault/vault.js';

let dirs: string[] = [];
function tempDir(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

describe('host import', () => {
  it('imports OpenSSH config hosts with identity files', () => {
    const dir = tempDir('sshp-import-ssh-');
    const keyPath = join(dir, 'id_ed25519');
    const configPath = join(dir, 'config');
    writeFileSync(keyPath, 'PRIVATE KEY', 'utf8');
    writeFileSync(configPath, `Host dev\n  HostName 10.0.0.1\n  User ubuntu\n  Port 2222\n  IdentityFile ${keyPath}\n`, 'utf8');
    const vault = initVault('master-password', dir);
    expect(importOpenSshConfig(configPath, vault)).toEqual({ imported: 1, skipped: 0 });
    const db = openMigratedDatabase(vault.dbPath);
    const server = new ServerRepository(db).findByName('dev');
    expect(server.host).toBe('10.0.0.1');
    expect(server.authType).toBe('private_key');
    db.close();
  });

  it('imports Termius-style CSV hosts', () => {
    const dir = tempDir('sshp-import-csv-');
    const csvPath = join(dir, 'hosts.csv');
    writeFileSync(csvPath, 'Label,Address,Username,Port,Password\nprod,example.com,root,22,secret\n', 'utf8');
    const vault = initVault('master-password', dir);
    expect(importTermiusCsv(csvPath, vault)).toEqual({ imported: 1, skipped: 0 });
    const db = openMigratedDatabase(vault.dbPath);
    const server = new ServerRepository(db).findByName('prod');
    expect(server.host).toBe('example.com');
    expect(server.authType).toBe('password');
    db.close();
  });
});
