import { describe, expect, it } from 'vitest';
import { decryptString, deriveKey, encryptString, generateSalt } from '../../src/vault/crypto.js';

 describe('vault crypto', () => {
  it('encrypts and decrypts a string', () => {
    const key = deriveKey('correct horse battery staple', generateSalt());
    const encrypted = encryptString('secret', key);
    expect(encrypted).not.toContain('secret');
    expect(decryptString(encrypted, key)).toBe('secret');
  });

  it('rejects the wrong key', () => {
    const salt = generateSalt();
    const encrypted = encryptString('secret', deriveKey('one', salt));
    expect(() => decryptString(encrypted, deriveKey('two', salt))).toThrow();
  });
});
