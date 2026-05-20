import { createServer, type Socket } from 'node:net';
import { Client, type ClientChannel } from 'ssh2';
import type { LocalForwardConfig, ServerCredentials, ServerRecord } from '../shared/types.js';

export interface LocalPortForwardOptions extends LocalForwardConfig {
  server: ServerRecord;
  credentials: ServerCredentials;
  onReady?: (config: LocalForwardConfig) => void;
  onConnection?: (source: string) => void;
}

export function startLocalPortForward({
  server,
  credentials,
  localHost,
  localPort,
  remoteHost,
  remotePort,
  onReady,
  onConnection
}: LocalPortForwardOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let localServer: ReturnType<typeof createServer> | undefined;
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
      localServer?.close();
      conn.end();
      if (error) reject(error);
      else resolve();
    };

    const stop = () => finish();

    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);

    conn.on('ready', () => {
      localServer = createServer((socket) => {
        const source = `${socket.remoteAddress ?? localHost}:${socket.remotePort ?? 0}`;
        onConnection?.(source);
        conn.forwardOut(
          socket.remoteAddress ?? localHost,
          socket.remotePort ?? 0,
          remoteHost,
          remotePort,
          (error, stream) => {
            if (error) {
              socket.destroy(error);
              return;
            }
            bridge(socket, stream);
          }
        );
      });

      localServer.on('error', finish);
      localServer.listen(localPort, localHost, () => {
        onReady?.({ localHost, localPort, remoteHost, remotePort });
      });
    });

    conn.on('error', finish);
    conn.on('close', () => finish());
    conn.connect({
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

function bridge(socket: Socket, stream: ClientChannel): void {
  socket.pipe(stream);
  stream.pipe(socket);
  socket.on('error', () => stream.end());
  stream.on('error', () => socket.destroy());
}
