import { existsSync } from 'node:fs';
import { ensureDataDir, resolveDataDir, resolveDbPath } from '../config/paths.js';
import { openMigratedDatabase, type Database } from '../db/connection.js';
import { SettingsRepository } from '../db/repositories/settingsRepository.js';
import { InvalidMasterPasswordError, MissingVaultError, VaultExistsError } from '../shared/errors.js';
import type { VaultContext } from '../shared/types.js';
import { decryptString, deriveKey, encryptString, generateSalt, KDF } from './crypto.js';

const VAULT_VERSION = '1';
const VERIFIER_TEXT = 'sshp-vault-verifier';

export function vaultExists(dataDir = resolveDataDir()): boolean {
  return existsSync(resolveDbPath(dataDir));
}

export function isVaultInitialized(db: Database): boolean {
  const settings = new SettingsRepository(db);
  return settings.get('vault.version') === VAULT_VERSION;
}

export function initVault(masterPassword: string, dataDir = resolveDataDir()): VaultContext {
  ensureDataDir(dataDir);
  const dbPath = resolveDbPath(dataDir);
  const db = openMigratedDatabase(dbPath);
  try {
    if (isVaultInitialized(db)) throw new VaultExistsError(dataDir);
    const salt = generateSalt();
    const key = deriveKey(masterPassword, salt);
    const settings = new SettingsRepository(db);
    settings.set('vault.version', VAULT_VERSION);
    settings.set('vault.kdf', KDF);
    settings.set('vault.kdfSalt', salt);
    settings.set('vault.verifier', encryptString(VERIFIER_TEXT, key));
    return { dataDir, dbPath, key };
  } finally {
    db.close();
  }
}

export function unlockVault(masterPassword: string, dataDir = resolveDataDir()): VaultContext {
  const dbPath = resolveDbPath(dataDir);
  if (!existsSync(dbPath)) throw new MissingVaultError(dataDir);
  const db = openMigratedDatabase(dbPath);
  try {
    const settings = new SettingsRepository(db);
    if (!isVaultInitialized(db)) throw new MissingVaultError(dataDir);
    const salt = settings.get('vault.kdfSalt');
    const verifier = settings.get('vault.verifier');
    if (!salt || !verifier) throw new MissingVaultError(dataDir);
    const key = deriveKey(masterPassword, salt);
    try {
      const plaintext = decryptString(verifier, key);
      if (plaintext !== VERIFIER_TEXT) throw new InvalidMasterPasswordError();
    } catch {
      throw new InvalidMasterPasswordError();
    }
    return { dataDir, dbPath, key };
  } finally {
    db.close();
  }
}

export function openVaultDatabase(vault: VaultContext): Database {
  return openMigratedDatabase(vault.dbPath);
}
