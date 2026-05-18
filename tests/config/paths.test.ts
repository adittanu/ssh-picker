import { describe, expect, it } from 'vitest';
import { defaultDataDir, resolveDataDir, resolveDbPath } from '../../src/config/paths.js';

describe('path handling', () => {
  it('uses ~/.sshp by default', () => {
    expect(defaultDataDir('/Users/alice').replace(/\\/g, '/')).toBe('/Users/alice/.sshp');
  });

  it('allows SSHP_DATA_DIR override', () => {
    const dir = resolveDataDir({ env: { SSHP_DATA_DIR: './custom-vault' }, home: '/Users/alice' });
    expect(dir.replace(/\\/g, '/')).toContain('custom-vault');
  });

  it('resolves db path inside the data directory', () => {
    expect(resolveDbPath('/tmp/sshp').replace(/\\/g, '/')).toBe('/tmp/sshp/sshp.db');
  });
});
