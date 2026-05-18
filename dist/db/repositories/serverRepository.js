import { NotFoundError } from '../../shared/errors.js';
function mapRow(row) {
    return {
        id: row.id,
        name: row.name,
        host: row.host,
        port: row.port,
        username: row.username,
        authType: row.auth_type,
        encryptedPassword: row.encrypted_password,
        encryptedPrivateKey: row.encrypted_private_key,
        encryptedPassphrase: row.encrypted_passphrase,
        tags: row.tags,
        notes: row.notes,
        defaultRemotePath: row.default_remote_path,
        lastConnectedAt: row.last_connected_at,
        connectionCount: row.connection_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}
export class ServerRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    create(input) {
        const now = new Date().toISOString();
        const result = this.db.prepare(`
      INSERT INTO servers (
        name, host, port, username, auth_type, encrypted_password,
        encrypted_private_key, encrypted_passphrase, tags, notes,
        default_remote_path, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.name, input.host, input.port, input.username, input.authType, input.encryptedPassword ?? null, input.encryptedPrivateKey ?? null, input.encryptedPassphrase ?? null, input.tags ?? null, input.notes ?? null, input.defaultRemotePath ?? null, now, now);
        return this.findById(Number(result.lastInsertRowid));
    }
    list() {
        const rows = this.db.prepare('SELECT * FROM servers ORDER BY name COLLATE NOCASE').all();
        return rows.map(mapRow);
    }
    findById(id) {
        const row = this.db.prepare('SELECT * FROM servers WHERE id = ?').get(id);
        if (!row)
            throw new NotFoundError('Server', String(id));
        return mapRow(row);
    }
    findByName(name) {
        const row = this.db.prepare('SELECT * FROM servers WHERE name = ?').get(name);
        if (!row)
            throw new NotFoundError('Server', name);
        return mapRow(row);
    }
    remove(id) {
        this.db.prepare('DELETE FROM servers WHERE id = ?').run(id);
    }
    update(id, input) {
        const current = this.findById(id);
        const next = { ...current, ...input };
        const now = new Date().toISOString();
        this.db.prepare(`
      UPDATE servers SET
        name = ?, host = ?, port = ?, username = ?, auth_type = ?,
        encrypted_password = ?, encrypted_private_key = ?, encrypted_passphrase = ?,
        tags = ?, notes = ?, default_remote_path = ?, updated_at = ?
      WHERE id = ?
    `).run(next.name, next.host, next.port, next.username, next.authType, next.encryptedPassword ?? null, next.encryptedPrivateKey ?? null, next.encryptedPassphrase ?? null, next.tags ?? null, next.notes ?? null, next.defaultRemotePath ?? null, now, id);
        return this.findById(id);
    }
    recordConnection(id, action, localPath, remotePath) {
        const now = new Date().toISOString();
        this.db.prepare(`
      UPDATE servers
      SET last_connected_at = ?, connection_count = connection_count + 1, updated_at = ?
      WHERE id = ?
    `).run(now, now, id);
        this.db.prepare(`
      INSERT INTO connection_history (server_id, action, local_path, remote_path, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, action, localPath ?? null, remotePath ?? null, now);
    }
}
//# sourceMappingURL=serverRepository.js.map