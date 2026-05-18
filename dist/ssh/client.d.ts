import type { ServerCredentials, ServerRecord } from '../shared/types.js';
export interface SshConnectionOptions {
    server: ServerRecord;
    credentials: ServerCredentials;
}
export declare function connectSsh({ server, credentials }: SshConnectionOptions): Promise<void>;
