#!/usr/bin/env node
import { jsx as _jsx } from "react/jsx-runtime";
import { Command } from 'commander';
import { render } from 'ink';
import { input, password, confirm } from '@inquirer/prompts';
import { existsSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { resolveDataDir, resolveDbPath, writeBootstrapConfig } from '../config/paths.js';
import { toFriendlyMessage } from '../shared/errors.js';
const originalEmitWarning = process.emitWarning.bind(process);
process.emitWarning = ((warning, ...args) => {
    const message = typeof warning === 'string' ? warning : warning.message;
    const type = typeof args[0] === 'string' ? args[0] : warning instanceof Error ? warning.name : undefined;
    if (type === 'ExperimentalWarning' && message.includes('SQLite'))
        return;
    return originalEmitWarning(warning, ...args);
});
async function askMasterPassword(message = 'Master password') {
    return password({ message, mask: '*' });
}
async function createVaultFromPrompt(dataDir = resolveDataDir()) {
    const first = await askMasterPassword('Create master password');
    const second = await askMasterPassword('Confirm master password');
    if (first !== second)
        throw new Error('Master passwords do not match.');
    const { initVault } = await import('../vault/vault.js');
    const vault = initVault(first, dataDir);
    console.log(`Initialized SSHP vault at ${vault.dataDir}`);
    return vault;
}
async function unlockFromPrompt() {
    const masterPassword = await askMasterPassword();
    const { unlockVault } = await import('../vault/vault.js');
    return unlockVault(masterPassword);
}
async function unlockOrInitializeVault() {
    const dataDir = resolveDataDir();
    if (!existsSync(resolveDbPath(dataDir))) {
        console.log('No SSHP vault found. Let\'s create one.');
        return createVaultFromPrompt(dataDir);
    }
    return unlockFromPrompt();
}
async function runInit() {
    await createVaultFromPrompt();
}
async function promptAddServer(vault) {
    const name = await input({ message: 'Name' });
    const host = await input({ message: 'Host' });
    const username = await input({ message: 'Username' });
    const portText = await input({ message: 'Port', default: '22' });
    const serverPassword = await password({ message: 'SSH password', mask: '*' });
    const defaultRemotePath = await input({ message: 'Default remote path', default: '/home/' + username });
    const [{ openMigratedDatabase }, { ServerRepository }, { encryptString }] = await Promise.all([
        import('../db/connection.js'),
        import('../db/repositories/serverRepository.js'),
        import('../vault/crypto.js')
    ]);
    const db = openMigratedDatabase(vault.dbPath);
    try {
        const server = new ServerRepository(db).create({
            name,
            host,
            username,
            port: Number(portText) || 22,
            authType: 'password',
            encryptedPassword: encryptString(serverPassword, vault.key),
            defaultRemotePath
        });
        console.log(`Added ${server.name} (${server.username}@${server.host}:${server.port})`);
        return server;
    }
    finally {
        db.close();
    }
}
async function runAdd() {
    const vault = await unlockOrInitializeVault();
    await promptAddServer(vault);
}
async function listServers(vault) {
    const [{ openMigratedDatabase }, { ServerRepository }] = await Promise.all([
        import('../db/connection.js'),
        import('../db/repositories/serverRepository.js')
    ]);
    const db = openMigratedDatabase(vault.dbPath);
    try {
        return new ServerRepository(db).list();
    }
    finally {
        db.close();
    }
}
async function runList() {
    const vault = await unlockFromPrompt();
    const servers = await listServers(vault);
    if (servers.length === 0) {
        console.log('No servers. Run `sshp add`.');
        return;
    }
    for (const server of servers) {
        console.log(`${server.name}\t${server.username}@${server.host}:${server.port}\t${server.connectionCount} connections`);
    }
}
async function loadServer(name) {
    const vault = await unlockFromPrompt();
    const [{ openMigratedDatabase }, { ServerRepository }] = await Promise.all([
        import('../db/connection.js'),
        import('../db/repositories/serverRepository.js')
    ]);
    const db = openMigratedDatabase(vault.dbPath);
    try {
        const repo = new ServerRepository(db);
        return { vault, server: repo.findByName(name) };
    }
    finally {
        db.close();
    }
}
async function recordServerAction(vaultDbPath, serverId, action, localPath, remotePath) {
    const [{ openMigratedDatabase }, { ServerRepository }] = await Promise.all([
        import('../db/connection.js'),
        import('../db/repositories/serverRepository.js')
    ]);
    const db = openMigratedDatabase(vaultDbPath);
    try {
        new ServerRepository(db).recordConnection(serverId, action, localPath, remotePath);
    }
    finally {
        db.close();
    }
}
async function runConnect(name) {
    const [{ connectSsh }, { decryptServerCredentials }] = await Promise.all([
        import('../ssh/client.js'),
        import('../shared/credentials.js')
    ]);
    const { vault, server } = await loadServer(name);
    await connectSsh({ server, credentials: decryptServerCredentials(server, vault) });
    await recordServerAction(vault.dbPath, server.id, 'ssh');
}
async function runDashboard() {
    const vault = await unlockOrInitializeVault();
    const servers = await listServers(vault);
    if (servers.length === 0) {
        const addFirstServer = await confirm({ message: 'No servers yet. Add your first server now?', default: true });
        if (!addFirstServer) {
            console.log('No servers saved. Run `sshp add` when you are ready.');
            return;
        }
        await promptAddServer(vault);
    }
    const { App } = await import('../tui/App.js');
    // Reset stdin so Ink can take over raw mode after @inquirer/prompts
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeAllListeners();
    }
    const app = render(_jsx(App, { vault: vault }));
    await app.waitUntilExit();
}
async function runFiles(name) {
    const { FileManager } = await import('../tui/screens/FileManager.js');
    const { vault, server } = await loadServer(name);
    // Reset stdin so Ink can take over raw mode after @inquirer/prompts
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeAllListeners();
    }
    const app = render(_jsx(FileManager, { server: server, vault: vault, onBack: () => undefined }));
    await app.waitUntilExit();
}
async function runUpload(name, localPath, remotePath) {
    const [{ withSftp }, { decryptServerCredentials }] = await Promise.all([
        import('../sftp/client.js'),
        import('../shared/credentials.js')
    ]);
    const { vault, server } = await loadServer(name);
    const overwrite = await confirm({ message: 'Overwrite remote path if it exists?', default: false });
    await withSftp({ server, credentials: decryptServerCredentials(server, vault) }, async (client) => {
        const stat = statSync(localPath);
        const target = stat.isDirectory() ? remotePath.replace(/\/$/, '') + '/' + basename(localPath) : remotePath;
        await client.uploadRecursive(localPath, target, overwrite);
    });
    await recordServerAction(vault.dbPath, server.id, 'upload', localPath, remotePath);
    console.log('Upload complete.');
}
async function runDownload(name, remotePath, localPath) {
    const [{ withSftp }, { decryptServerCredentials }] = await Promise.all([
        import('../sftp/client.js'),
        import('../shared/credentials.js')
    ]);
    const { vault, server } = await loadServer(name);
    const overwrite = await confirm({ message: 'Overwrite local path if it exists?', default: false });
    await withSftp({ server, credentials: decryptServerCredentials(server, vault) }, async (client) => {
        await client.downloadFile(remotePath, localPath, overwrite);
    });
    await recordServerAction(vault.dbPath, server.id, 'download', localPath, remotePath);
    console.log('Download complete.');
}
async function runExport(file) {
    const { exportVault } = await import('../import-export/archive.js');
    console.log(`Exported to ${exportVault(file)}`);
}
async function runImport(file) {
    const { importVault } = await import('../import-export/archive.js');
    const ok = await confirm({ message: 'Import will replace the current vault database. Continue?', default: false });
    if (!ok)
        return;
    console.log(`Imported to ${importVault(file)}`);
}
async function main() {
    const program = new Command();
    program
        .name('sshp')
        .description('Portable encrypted SSH/SFTP picker')
        .version('0.1.3')
        .action(runDashboard);
    program.command('init').description('Create a portable encrypted vault').action(runInit);
    program.command('add').description('Add a password-based SSH server').action(runAdd);
    program.command('list').description('List saved servers').action(runList);
    program.command('connect <server>').description('Connect to a server over SSH').action(runConnect);
    program.command('files <server>').description('Open the SFTP file manager').action(runFiles);
    program.command('upload <server> <local> <remote>').description('Upload a file or folder over SFTP').action(runUpload);
    program.command('download <server> <remote> <local>').description('Download a file over SFTP').action(runDownload);
    program.command('export <file>').description('Export encrypted vault backup').action(runExport);
    program.command('import <file>').description('Import encrypted vault backup').action(runImport);
    const config = program.command('config').description('Manage SSHP configuration');
    config.command('set <key> <value>').description('Set a config value').action((key, value) => {
        if (key !== 'dataDir')
            throw new Error('Only dataDir is supported.');
        writeBootstrapConfig({ dataDir: value });
        console.log(`dataDir set to ${value}`);
    });
    await program.parseAsync(process.argv);
}
main().catch((error) => {
    console.error(toFriendlyMessage(error));
    process.exitCode = 1;
});
//# sourceMappingURL=index.js.map