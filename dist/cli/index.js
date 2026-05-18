#!/usr/bin/env node
import { jsx as _jsx } from "react/jsx-runtime";
import { Command } from 'commander';
import { render } from 'ink';
import { input, password, confirm } from '@inquirer/prompts';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
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
const cyan = '\u001B[36m';
const green = '\u001B[32m';
const dim = '\u001B[2m';
const reset = '\u001B[0m';
function clearTerminal() {
    if (!process.stdout.isTTY)
        return;
    process.stdout.write('\u001B[2J\u001B[3J\u001B[H');
}
function terminalLine(char = '-') {
    return char.repeat(Math.min(process.stdout.columns || 80, 90));
}
function renderPromptHeader(title, subtitle) {
    if (!process.stdout.isTTY)
        return;
    clearTerminal();
    console.log(`${cyan}SSHP${reset} ${dim}Portable SSH and SFTP vault${reset}`);
    console.log(terminalLine());
    console.log(`${green}${title}${reset}`);
    console.log(`${dim}${subtitle}${reset}`);
    console.log();
}
function renderSshHandoff(server) {
    clearTerminal();
    if (!process.stdout.isTTY)
        return;
    console.log(`${cyan}SSHP SSH${reset} ${dim}${server.name}${reset}`);
    console.log(terminalLine());
    console.log(`${dim}Connected terminal is now fully controlled by ${server.username}@${server.host}:${server.port}.${reset}`);
    console.log(`${dim}Type exit or press Ctrl+D in the remote shell to close the session.${reset}`);
    console.log();
}
async function askMasterPassword(message = 'Master password') {
    const lower = message.toLowerCase();
    const subtitle = lower.includes('backup')
        ? 'Decrypt an encrypted SSHP backup before restoring it.'
        : lower.includes('create') || lower.includes('confirm')
            ? 'Create a master key for this local encrypted vault.'
            : 'Unlock your saved SSH credentials for this session.';
    renderPromptHeader(message, subtitle);
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
    const vault = unlockVault(masterPassword);
    clearTerminal();
    return vault;
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
function validateRequired(value) {
    return value.trim() ? true : 'Required.';
}
function validatePort(value) {
    const port = Number(value);
    return Number.isInteger(port) && port > 0 && port <= 65_535 ? true : 'Port must be between 1 and 65535.';
}
async function promptAddServer(vault) {
    const name = (await input({ message: 'Name', validate: validateRequired })).trim();
    const host = (await input({ message: 'Host', validate: validateRequired })).trim();
    const username = (await input({ message: 'Username', validate: validateRequired })).trim();
    const portText = await input({ message: 'Port', default: '22', validate: validatePort });
    const authText = (await input({ message: 'Auth method', default: 'password', validate: validateAuthType })).trim();
    const authType = normalizeAuthType(authText);
    const serverPassword = authType === 'password' ? await password({ message: 'SSH password', mask: '*', validate: validateRequired }) : '';
    const privateKeyPath = authType === 'private_key' ? await input({ message: 'Private key path', default: '~/.ssh/id_ed25519', validate: validateRequired }) : '';
    const passphrase = authType === 'private_key' ? await password({ message: 'Key passphrase (optional)', mask: '*' }) : '';
    const defaultRemotePath = (await input({ message: 'Default remote path', default: '/home/' + username, validate: validateRequired })).trim();
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
            port: Number(portText),
            authType,
            encryptedPassword: serverPassword ? encryptString(serverPassword, vault.key) : null,
            encryptedPrivateKey: privateKeyPath ? encryptString(readFileSync(expandUserPath(privateKeyPath), 'utf8'), vault.key) : null,
            encryptedPassphrase: passphrase ? encryptString(passphrase, vault.key) : null,
            defaultRemotePath
        });
        console.log(`Added ${server.name} (${server.username}@${server.host}:${server.port})`);
        return server;
    }
    finally {
        db.close();
    }
}
function validateAuthType(value) {
    return parseAuthType(value) ? true : 'Use password or private_key.';
}
function parseAuthType(value) {
    const normalized = value.trim().toLowerCase().replace(/[- ]/g, '_');
    if (normalized === 'password' || normalized === 'pass')
        return 'password';
    if (normalized === 'key' || normalized === 'private_key')
        return 'private_key';
    return null;
}
function normalizeAuthType(value) {
    return parseAuthType(value) ?? 'password';
}
function expandUserPath(path) {
    if (path === '~' || path.startsWith('~/')) {
        return join(homedir(), path.slice(2));
    }
    return path;
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
    renderSshHandoff(server);
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
    clearTerminal();
    const { App } = await import('../tui/App.js');
    // Reset stdin so Ink can take over raw mode after @inquirer/prompts
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeAllListeners();
    }
    const app = render(_jsx(App, { vault: vault }));
    const result = await app.waitUntilExit();
    app.clear();
    if (result?.action === 'connect') {
        const [{ connectSsh }, { decryptServerCredentials }] = await Promise.all([
            import('../ssh/client.js'),
            import('../shared/credentials.js')
        ]);
        renderSshHandoff(result.server);
        await connectSsh({ server: result.server, credentials: decryptServerCredentials(result.server, vault) });
        await recordServerAction(vault.dbPath, result.server.id, 'ssh');
    }
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
    clearTerminal();
    const app = render(_jsx(FileManager, { server: server, vault: vault, onBack: () => undefined, exitOnBack: true }));
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
    const vault = await unlockFromPrompt();
    console.log(`Exported to ${exportVault(file, vault)}`);
}
async function runImport(file) {
    const { importVault } = await import('../import-export/archive.js');
    const ok = await confirm({ message: 'Import will replace the current vault database. Continue?', default: false });
    if (!ok)
        return;
    const masterPassword = await askMasterPassword('Backup master password');
    console.log(`Imported to ${importVault(file, masterPassword)}`);
}
async function runImportSshConfig(file) {
    const vault = await unlockFromPrompt();
    const { importOpenSshConfig } = await import('../import-export/hostImport.js');
    const target = file || join(homedir(), '.ssh', 'config');
    const result = importOpenSshConfig(target, vault);
    console.log(`Imported ${result.imported} host(s) from ${target}. Skipped ${result.skipped} duplicate(s).`);
}
async function runImportTermius(file) {
    const vault = await unlockFromPrompt();
    const { importTermiusCsv } = await import('../import-export/hostImport.js');
    const result = importTermiusCsv(file, vault);
    console.log(`Imported ${result.imported} host(s) from Termius CSV. Skipped ${result.skipped} duplicate(s).`);
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
    program.command('import-ssh-config [file]').description('Import hosts from OpenSSH config').action(runImportSshConfig);
    program.command('import-termius <csv>').description('Import hosts from a Termius-style CSV').action(runImportTermius);
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