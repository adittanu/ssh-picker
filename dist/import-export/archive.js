import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { resolveDataDir, resolveDbPath } from '../config/paths.js';
import { openMigratedDatabase } from '../db/connection.js';
import { SettingsRepository } from '../db/repositories/settingsRepository.js';
import { MissingVaultError, SshpError } from '../shared/errors.js';
import { decryptString, deriveKey, encryptString, KDF } from '../vault/crypto.js';
const MAGIC = 'SSHP_BACKUP_V2';
export function exportVault(outFile, vault) {
    const dbPath = resolveDbPath(vault.dataDir);
    if (!existsSync(dbPath))
        throw new MissingVaultError(vault.dataDir);
    const kdfSalt = readKdfSalt(dbPath);
    checkpointDatabase(dbPath);
    const payload = {
        magic: MAGIC,
        exportedAt: new Date().toISOString(),
        kdf: KDF,
        kdfSalt,
        encryptedDatabase: encryptString(readFileSync(dbPath).toString('base64'), vault.key)
    };
    const target = resolve(outFile);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return target;
}
export function importVault(inFile, masterPassword, dataDir = resolveDataDir()) {
    const source = resolve(inFile);
    const payload = JSON.parse(readFileSync(source, 'utf8'));
    if (payload.magic !== MAGIC || payload.kdf !== KDF || !payload.kdfSalt || !payload.encryptedDatabase) {
        throw new SshpError('Unsupported or corrupt SSHP backup file.', 'INVALID_BACKUP');
    }
    let database;
    try {
        database = decryptString(payload.encryptedDatabase, deriveKey(masterPassword, payload.kdfSalt));
    }
    catch {
        throw new SshpError('Backup master password is incorrect or the backup is corrupt.', 'INVALID_BACKUP_PASSWORD');
    }
    mkdirSync(dataDir, { recursive: true });
    const dbPath = resolveDbPath(dataDir);
    removeSqliteSidecars(dbPath);
    writeFileSync(dbPath, Buffer.from(database, 'base64'));
    return dbPath;
}
export function copyVaultDataDir(sourceDbPath, dataDir = resolveDataDir()) {
    mkdirSync(dataDir, { recursive: true });
    const dbPath = resolveDbPath(dataDir);
    copyFileSync(sourceDbPath, dbPath);
    return dbPath;
}
function readKdfSalt(dbPath) {
    const db = openMigratedDatabase(dbPath);
    try {
        const salt = new SettingsRepository(db).get('vault.kdfSalt');
        if (!salt)
            throw new MissingVaultError(dirname(dbPath));
        return salt;
    }
    finally {
        db.close();
    }
}
function checkpointDatabase(dbPath) {
    const db = openMigratedDatabase(dbPath);
    try {
        db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    }
    finally {
        db.close();
    }
}
function removeSqliteSidecars(dbPath) {
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
}
//# sourceMappingURL=archive.js.map