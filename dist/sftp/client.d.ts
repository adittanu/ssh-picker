import type { DirectoryEntry, ServerCredentials, ServerRecord } from '../shared/types.js';
export interface SftpConnectionOptions {
    server: ServerRecord;
    credentials: ServerCredentials;
}
export declare function listLocalDirectory(path: string): DirectoryEntry[];
export declare class SftpClient {
    private conn?;
    private sftp?;
    connect({ server, credentials }: SftpConnectionOptions): Promise<void>;
    close(): void;
    listRemoteDirectory(path: string): Promise<DirectoryEntry[]>;
    uploadFile(localPath: string, remotePath: string, overwrite?: boolean): Promise<void>;
    downloadFile(remotePath: string, localPath: string, overwrite?: boolean): Promise<void>;
    uploadRecursive(localPath: string, remotePath: string, overwrite?: boolean): Promise<void>;
    downloadRecursive(remotePath: string, localPath: string, overwrite?: boolean): Promise<void>;
    private remoteExists;
    private mkdirRemote;
    private requireSftp;
}
export declare function withSftp<T>(options: SftpConnectionOptions, fn: (client: SftpClient) => Promise<T>): Promise<T>;
