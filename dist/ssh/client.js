import { Client } from 'ssh2';
export function connectSsh({ server, credentials }) {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        const cleanup = () => {
            if (process.stdin.isTTY)
                process.stdin.setRawMode?.(false);
            process.stdin.unpipe();
        };
        conn.on('ready', () => {
            conn.shell((err, stream) => {
                if (err) {
                    conn.end();
                    reject(err);
                    return;
                }
                if (process.stdin.isTTY)
                    process.stdin.setRawMode?.(true);
                process.stdin.resume();
                process.stdin.pipe(stream);
                stream.pipe(process.stdout);
                stream.stderr.pipe(process.stderr);
                stream.on('close', () => {
                    cleanup();
                    conn.end();
                    resolve();
                });
            });
        });
        conn.on('error', (error) => {
            cleanup();
            reject(error);
        });
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
//# sourceMappingURL=client.js.map