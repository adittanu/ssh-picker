import { mkdtempSync, rmSync } from 'node:fs';
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
    initVault('master-password', source);
    exportVault(file, source);
    importVault(file, target);
    expect(unlockVault('master-password', target).dataDir).toBe(target);
    expect(() => unlockVault('wrong-password', target)).toThrow(/incorrect/);
  });
});
