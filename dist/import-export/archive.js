import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { resolveDataDir, resolveDbPath } from '../config/paths.js';
import { MissingVaultError, SshpError } from '../shared/errors.js';
const MAGIC = 'SSHP_BACKUP_V1';
export function exportVault(outFile, dataDir = resolveDataDir()) {
    const dbPath = resolveDbPath(dataDir);
    if (!existsSync(dbPath))
        throw new MissingVaultError(dataDir);
    const payload = {
        magic: MAGIC,
        exportedAt: new Date().toISOString(),
        database: readFileSync(dbPath).toString('base64')
    };
    const target = resolve(outFile);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return target;
}
export function importVault(inFile, dataDir = resolveDataDir()) {
    const source = resolve(inFile);
    const payload = JSON.parse(readFileSync(source, 'utf8'));
    if (payload.magic !== MAGIC || !payload.database) {
        throw new SshpError('Unsupported or corrupt SSHP backup file.', 'INVALID_BACKUP');
    }
    mkdirSync(dataDir, { recursive: true });
    const dbPath = resolveDbPath(dataDir);
    writeFileSync(dbPath, Buffer.from(payload.database, 'base64'));
    return dbPath;
}
export function copyVaultDataDir(sourceDbPath, dataDir = resolveDataDir()) {
    mkdirSync(dataDir, { recursive: true });
    const dbPath = resolveDbPath(dataDir);
    copyFileSync(sourceDbPath, dbPath);
    return dbPath;
}
//# sourceMappingURL=archive.js.map