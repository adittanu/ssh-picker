import { decryptString } from '../vault/crypto.js';
import type { ServerCredentials, ServerRecord, VaultContext } from './types.js';

export function decryptServerCredentials(server: ServerRecord, vault: VaultContext): ServerCredentials {
  return {
    password: server.encryptedPassword ? decryptString(server.encryptedPassword, vault.key) : undefined,
    privateKey: server.encryptedPrivateKey ? decryptString(server.encryptedPrivateKey, vault.key) : undefined,
    passphrase: server.encryptedPassphrase ? decryptString(server.encryptedPassphrase, vault.key) : undefined
  };
}
