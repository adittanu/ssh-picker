import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { Client, type FileEntryWithStats, type SFTPWrapper } from 'ssh2';
import type { DirectoryEntry, ServerCredentials, ServerRecord } from '../shared/types.js';
import { SshpError } from '../shared/errors.js';

export interface SftpConnectionOptions {
  server: ServerRecord;
  credentials: ServerCredentials;
}

export function listLocalDirectory(path: string): DirectoryEntry[] {
  return readdirSync(path, { withFileTypes: true })
    .map((entry) => {
      const fullPath = join(path, entry.name);
      const stat = statSync(fullPath);
      return { name: entry.name, path: fullPath, isDirectory: entry.isDirectory(), size: stat.size, modifiedAt: stat.mtime };
    })
    .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));
}

export class SftpClient {
  private conn?: Client;
  private sftp?: SFTPWrapper;

  async connect({ server, credentials }: SftpConnectionOptions): Promise<void> {
    this.conn = new Client();
    await new Promise<void>((resolve, reject) => {
      this.conn!.on('ready', () => {
        this.conn!.sftp((err, sftp) => {
          if (err) reject(err);
          else {
            this.sftp = sftp;
            resolve();
          }
        });
      });
      this.conn!.on('error', reject);
      this.conn!.connect({
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

  close(): void {
    this.conn?.end();
  }

  async listRemoteDirectory(path: string): Promise<DirectoryEntry[]> {
    const sftp = this.requireSftp();
    const rows = await new Promise<FileEntryWithStats[]>((resolve, reject) => {
      sftp.readdir(path, (err, list) => err ? reject(err) : resolve(list));
    });
    return rows.map((entry: FileEntryWithStats) => ({ 
      name: entry.filename,
      path: path.replace(/\/$/, '') + '/' + entry.filename,
      isDirectory: entry.attrs.isDirectory(),
      size: entry.attrs.size,
      modifiedAt: new Date(entry.attrs.mtime * 1000)
    })).sort((a: DirectoryEntry, b: DirectoryEntry) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));
  }

  async uploadFile(localPath: string, remotePath: string, overwrite = false): Promise<void> {
    const sftp = this.requireSftp();
    if (!overwrite && await this.remoteExists(remotePath)) throw new SshpError(`Remote path already exists: ${remotePath}`, 'OVERWRITE_CONFLICT');
    await new Promise<void>((resolve, reject) => {
      sftp.fastPut(localPath, remotePath, (err) => err ? reject(err) : resolve());
    });
  }

  async downloadFile(remotePath: string, localPath: string, overwrite = false): Promise<void> {
    const sftp = this.requireSftp();
    if (!overwrite && existsSync(localPath)) throw new SshpError(`Local path already exists: ${localPath}`, 'OVERWRITE_CONFLICT');
    mkdirSync(dirname(localPath), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      sftp.fastGet(remotePath, localPath, (err) => err ? reject(err) : resolve());
    });
  }

  async uploadRecursive(localPath: string, remotePath: string, overwrite = false): Promise<void> {
    const stat = statSync(localPath);
    if (!stat.isDirectory()) return this.uploadFile(localPath, remotePath, overwrite);
    await this.mkdirRemote(remotePath);
    for (const entry of readdirSync(localPath, { withFileTypes: true })) {
      await this.uploadRecursive(join(localPath, entry.name), remotePath.replace(/\/$/, '') + '/' + entry.name, overwrite);
    }
  }

  async downloadRecursive(remotePath: string, localPath: string, overwrite = false): Promise<void> {
    const entries = await this.listRemoteDirectory(remotePath);
    mkdirSync(localPath, { recursive: true });
    for (const entry of entries) {
      const target = join(localPath, basename(entry.name));
      if (entry.isDirectory) await this.downloadRecursive(entry.path, target, overwrite);
      else await this.downloadFile(entry.path, target, overwrite);
    }
  }

  private async remoteExists(remotePath: string): Promise<boolean> {
    const sftp = this.requireSftp();
    return new Promise((resolve) => {
      sftp.stat(remotePath, (err) => resolve(!err));
    });
  }

  private async mkdirRemote(remotePath: string): Promise<void> {
    const sftp = this.requireSftp();
    await new Promise<void>((resolve) => {
      sftp.mkdir(remotePath, { mode: 0o755 }, () => resolve());
    });
  }

  private requireSftp(): SFTPWrapper {
    if (!this.sftp) throw new SshpError('SFTP client is not connected.', 'SFTP_NOT_CONNECTED');
    return this.sftp;
  }
}

export async function withSftp<T>(options: SftpConnectionOptions, fn: (client: SftpClient) => Promise<T>): Promise<T> {
  const client = new SftpClient();
  await client.connect(options);
  try {
    return await fn(client);
  } finally {
    client.close();
  }
}
