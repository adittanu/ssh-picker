import type { DirectoryEntry, ServerCredentials, ServerRecord } from '../shared/types.js';
export interface SftpConnectionOptions {
    server: ServerRecord;
    credentials: ServerCredentials;
}
export interface TransferProgress {
    action: 'upload' | 'download';
    path: string;
    bytesTransferred: number;
    totalBytes?: number;
}
export type TransferProgressHandler = (progress: TransferProgress) => void;
export declare function listLocalDirectory(path: string): DirectoryEntry[];
export declare class SftpClient {
    private conn?;
    private sftp?;
    connect({ server, credentials }: SftpConnectionOptions): Promise<void>;
    close(): void;
    listRemoteDirectory(path: string): Promise<DirectoryEntry[]>;
    uploadFile(localPath: string, remotePath: string, overwrite?: boolean, onProgress?: TransferProgressHandler): Promise<void>;
    downloadFile(remotePath: string, localPath: string, overwrite?: boolean, onProgress?: TransferProgressHandler): Promise<void>;
    uploadRecursive(localPath: string, remotePath: string, overwrite?: boolean, onProgress?: TransferProgressHandler): Promise<void>;
    downloadRecursive(remotePath: string, localPath: string, overwrite?: boolean, onProgress?: TransferProgressHandler): Promise<void>;
    makeRemoteDirectory(remotePath: string): Promise<void>;
    renameRemote(sourcePath: string, targetPath: string): Promise<void>;
    chmodRemote(remotePath: string, mode: number): Promise<void>;
    deleteRemote(remotePath: string): Promise<void>;
    private remoteExists;
    private statRemote;
    private mkdirRemote;
    private unlinkRemote;
    private rmdirRemote;
    private requireSftp;
}
export declare function withSftp<T>(options: SftpConnectionOptions, fn: (client: SftpClient) => Promise<T>): Promise<T>;
