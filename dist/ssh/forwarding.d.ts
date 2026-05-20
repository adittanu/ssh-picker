import type { LocalForwardConfig, ServerCredentials, ServerRecord } from '../shared/types.js';
export interface LocalPortForwardOptions extends LocalForwardConfig {
    server: ServerRecord;
    credentials: ServerCredentials;
    onReady?: (config: LocalForwardConfig) => void;
    onConnection?: (source: string) => void;
}
export declare function startLocalPortForward({ server, credentials, localHost, localPort, remoteHost, remotePort, onReady, onConnection }: LocalPortForwardOptions): Promise<void>;
