import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { Client } from 'ssh2';
import { SshpError } from '../shared/errors.js';
export function listLocalDirectory(path) {
    return readdirSync(path, { withFileTypes: true })
        .map((entry) => {
        const fullPath = join(path, entry.name);
        const stat = statSync(fullPath);
        return { name: entry.name, path: fullPath, isDirectory: entry.isDirectory(), size: stat.size, modifiedAt: stat.mtime };
    })
        .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));
}
export class SftpClient {
    conn;
    sftp;
    async connect({ server, credentials }) {
        this.conn = new Client();
        await new Promise((resolve, reject) => {
            this.conn.on('ready', () => {
                this.conn.sftp((err, sftp) => {
                    if (err)
                        reject(err);
                    else {
                        this.sftp = sftp;
                        resolve();
                    }
                });
            });
            this.conn.on('error', reject);
            this.conn.connect({
                host: server.host,
                port: server.port,
                username: server.username,
                password: credentials.password,
                privateKey: credentials.privateKey,
                passphrase: credentials.passphrase,
                readyTimeout: 20_000
            });
        });
    }
    close() {
        this.conn?.end();
    }
    async listRemoteDirectory(path) {
        const sftp = this.requireSftp();
        const rows = await new Promise((resolve, reject) => {
            sftp.readdir(path, (err, list) => err ? reject(err) : resolve(list));
        });
        return rows.map((entry) => ({
            name: entry.filename,
            path: path.replace(/\/$/, '') + '/' + entry.filename,
            isDirectory: entry.attrs.isDirectory(),
            size: entry.attrs.size,
            modifiedAt: new Date(entry.attrs.mtime * 1000)
        })).sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));
    }
    async uploadFile(localPath, remotePath, overwrite = false) {
        const sftp = this.requireSftp();
        if (!overwrite && await this.remoteExists(remotePath))
            throw new SshpError(`Remote path already exists: ${remotePath}`, 'OVERWRITE_CONFLICT');
        await new Promise((resolve, reject) => {
            sftp.fastPut(localPath, remotePath, (err) => err ? reject(err) : resolve());
        });
    }
    async downloadFile(remotePath, localPath, overwrite = false) {
        const sftp = this.requireSftp();
        if (!overwrite && existsSync(localPath))
            throw new SshpError(`Local path already exists: ${localPath}`, 'OVERWRITE_CONFLICT');
        mkdirSync(dirname(localPath), { recursive: true });
        await new Promise((resolve, reject) => {
            sftp.fastGet(remotePath, localPath, (err) => err ? reject(err) : resolve());
        });
    }
    async uploadRecursive(localPath, remotePath, overwrite = false) {
        const stat = statSync(localPath);
        if (!stat.isDirectory())
            return this.uploadFile(localPath, remotePath, overwrite);
        await this.mkdirRemote(remotePath);
        for (const entry of readdirSync(localPath, { withFileTypes: true })) {
            await this.uploadRecursive(join(localPath, entry.name), remotePath.replace(/\/$/, '') + '/' + entry.name, overwrite);
        }
    }
    async downloadRecursive(remotePath, localPath, overwrite = false) {
        const entries = await this.listRemoteDirectory(remotePath);
        mkdirSync(localPath, { recursive: true });
        for (const entry of entries) {
            const target = join(localPath, basename(entry.name));
            if (entry.isDirectory)
                await this.downloadRecursive(entry.path, target, overwrite);
            else
                await this.downloadFile(entry.path, target, overwrite);
        }
    }
    async remoteExists(remotePath) {
        const sftp = this.requireSftp();
        return new Promise((resolve) => {
            sftp.stat(remotePath, (err) => resolve(!err));
        });
    }
    async mkdirRemote(remotePath) {
        const sftp = this.requireSftp();
        await new Promise((resolve) => {
            sftp.mkdir(remotePath, { mode: 0o755 }, () => resolve());
        });
    }
    requireSftp() {
        if (!this.sftp)
            throw new SshpError('SFTP client is not connected.', 'SFTP_NOT_CONNECTED');
        return this.sftp;
    }
}
export async function withSftp(options, fn) {
    const client = new SftpClient();
    await client.connect(options);
    try {
        return await fn(client);
    }
    finally {
        client.close();
    }
}
//# sourceMappingURL=client.js.map