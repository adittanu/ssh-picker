import { Client } from 'ssh2';
export function connectSsh({ server, credentials }) {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        let stream;
        let removeResizeListener;
        let settled = false;
        const cleanup = () => {
            if (process.stdin.isTTY)
                process.stdin.setRawMode?.(false);
            if (stream)
                process.stdin.unpipe(stream);
            removeResizeListener?.();
            removeResizeListener = undefined;
        };
        const settle = (error) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            conn.end();
            if (error)
                reject(error);
            else
                resolve();
        };
        conn.on('ready', () => {
            conn.shell({
                term: process.env.TERM || 'xterm-256color',
                cols: process.stdout.columns || 80,
                rows: process.stdout.rows || 24
            }, (err, channel) => {
                if (err) {
                    settle(err);
                    return;
                }
                stream = channel;
                const resize = () => {
                    channel.setWindow(process.stdout.rows || 24, process.stdout.columns || 80, 0, 0);
                };
                process.stdout.on('resize', resize);
                removeResizeListener = () => process.stdout.off('resize', resize);
                if (process.stdin.isTTY)
                    process.stdin.setRawMode?.(true);
                process.stdin.resume();
                process.stdin.pipe(channel);
                channel.pipe(process.stdout);
                channel.stderr.pipe(process.stderr);
                channel.on('error', settle);
                channel.on('close', () => settle());
            });
        });
        conn.on('error', settle);
        conn.on('close', () => settle());
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
export function testSshConnection({ server, credentials }) {
    const startedAt = Date.now();
    return new Promise((resolve, reject) => {
        const conn = new Client();
        let settled = false;
        const settle = (error) => {
            if (settled)
                return;
            settled = true;
            conn.end();
            if (error)
                reject(error);
            else
                resolve({ elapsedMs: Date.now() - startedAt });
        };
        conn.on('ready', () => settle());
        conn.on('error', settle);
        conn.on('close', () => {
            if (!settled)
                settle(new Error('SSH connection closed before authentication completed.'));
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