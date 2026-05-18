import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { exportVault, importVault } from '../../src/import-export/archive.js';
import { initVault, unlockVault } from '../../src/vault/vault.js';

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

describe('import/export archive', () => {
  it('roundtrips the encrypted vault database', () => {
    const source = tempDir('sshp-export-source-');
    const target = tempDir('sshp-export-target-');
    const file = join(tempDir('sshp-export-file-'), 'backup.sshp');
    const vault = initVault('master-password', source);
    exportVault(file, vault);
    expect(readFileSync(file, 'utf8')).not.toContain('sshp-vault-verifier');
    expect(() => importVault(file, 'wrong-password', target)).toThrow();
    importVault(file, 'master-password', target);
    expect(unlockVault('master-password', target).dataDir).toBe(target);
    expect(() => unlockVault('wrong-password', target)).toThrow(/incorrect/);
  });

  it('removes stale SQLite sidecar files before import', () => {
    const source = tempDir('sshp-export-source-');
    const target = tempDir('sshp-export-target-');
    const file = join(tempDir('sshp-export-file-'), 'backup.sshp');
    const vault = initVault('master-password', source);
    exportVault(file, vault);
    writeFileSync(join(target, 'sshp.db-wal'), 'stale');
    writeFileSync(join(target, 'sshp.db-shm'), 'stale');
    importVault(file, 'master-password', target);
    expect(existsSync(join(target, 'sshp.db-wal'))).toBe(false);
    expect(existsSync(join(target, 'sshp.db-shm'))).toBe(false);
  });
});
