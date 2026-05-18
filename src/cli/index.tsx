#!/usr/bin/env node
import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { input, password, confirm } from '@inquirer/prompts';
import { statSync } from 'node:fs';
import { basename } from 'node:path';
import { writeBootstrapConfig } from '../config/paths.js';
import { toFriendlyMessage } from '../shared/errors.js';
import type { ServerRecord, VaultContext } from '../shared/types.js';

async function askMasterPassword(message = 'Master password'): Promise<string> {
  return password({ message, mask: '*' });
}

async function unlockFromPrompt(): Promise<VaultContext> {
  const { unlockVault } = await import('../vault/vault.js');
  return unlockVault(await askMasterPassword());
}

async function runInit(): Promise<void> {
  const { initVault } = await import('../vault/vault.js');
  const first = await askMasterPassword('Create master password');
  const second = await askMasterPassword('Confirm master password');
  if (first !== second) throw new Error('Master passwords do not match.');
  const vault = initVault(first);
  console.log(`Initialized SSHP vault at ${vault.dataDir}`);
}

async function runAdd(): Promise<void> {
  const [{ openMigratedDatabase }, { ServerRepository }, { encryptString }] = await Promise.all([
    import('../db/connection.js'),
    import('../db/repositories/serverRepository.js'),
    import('../vault/crypto.js')
  ]);
  const vault = await unlockFromPrompt();
  const name = await input({ message: 'Name' });
  const host = await input({ message: 'Host' });
  const username = await input({ message: 'Username' });
  const portText = await input({ message: 'Port', default: '22' });
  const serverPassword = await password({ message: 'SSH password', mask: '*' });
  const defaultRemotePath = await input({ message: 'Default remote path', default: '/home/' + username });
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
  } finally {
    db.close();
  }
}

async function runList(): Promise<void> {
  const [{ openMigratedDatabase }, { ServerRepository }] = await Promise.all([
    import('../db/connection.js'),
    import('../db/repositories/serverRepository.js')
  ]);
  const vault = await unlockFromPrompt();
  const db = openMigratedDatabase(vault.dbPath);
  try {
    const servers = new ServerRepository(db).list();
    if (servers.length === 0) {
      console.log('No servers. Run `sshp add`.');
      return;
    }
    for (const server of servers) {
      console.log(`${server.name}\t${server.username}@${server.host}:${server.port}\t${server.connectionCount} connections`);
    }
  } finally {
    db.close();
  }
}

async function loadServer(name: string): Promise<{ vault: VaultContext; server: ServerRecord }> {
  const [{ openMigratedDatabase }, { ServerRepository }] = await Promise.all([
    import('../db/connection.js'),
    import('../db/repositories/serverRepository.js')
  ]);
  const vault = await unlockFromPrompt();
  const db = openMigratedDatabase(vault.dbPath);
  try {
    const repo = new ServerRepository(db);
    return { vault, server: repo.findByName(name) };
  } finally {
    db.close();
  }
}

async function recordServerAction(vaultDbPath: string, serverId: number, action: string, localPath?: string, remotePath?: string): Promise<void> {
  const [{ openMigratedDatabase }, { ServerRepository }] = await Promise.all([
    import('../db/connection.js'),
    import('../db/repositories/serverRepository.js')
  ]);
  const db = openMigratedDatabase(vaultDbPath);
  try {
    new ServerRepository(db).recordConnection(serverId, action, localPath, remotePath);
  } finally {
    db.close();
  }
}

async function runConnect(name: string): Promise<void> {
  const [{ connectSsh }, { decryptServerCredentials }] = await Promise.all([
    import('../ssh/client.js'),
    import('../shared/credentials.js')
  ]);
  const { vault, server } = await loadServer(name);
  await connectSsh({ server, credentials: decryptServerCredentials(server, vault) });
  await recordServerAction(vault.dbPath, server.id, 'ssh');
}

async function runDashboard(): Promise<void> {
  const { App } = await import('../tui/App.js');
  const vault = await unlockFromPrompt();
  render(<App vault={vault} />);
}

async function runFiles(name: string): Promise<void> {
  const { FileManager } = await import('../tui/screens/FileManager.js');
  const { vault, server } = await loadServer(name);
  render(<FileManager server={server} vault={vault} onBack={() => undefined} />);
}

async function runUpload(name: string, localPath: string, remotePath: string): Promise<void> {
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

async function runDownload(name: string, remotePath: string, localPath: string): Promise<void> {
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

async function runExport(file: string): Promise<void> {
  const { exportVault } = await import('../import-export/archive.js');
  console.log(`Exported to ${exportVault(file)}`);
}

async function runImport(file: string): Promise<void> {
  const { importVault } = await import('../import-export/archive.js');
  const ok = await confirm({ message: 'Import will replace the current vault database. Continue?', default: false });
  if (!ok) return;
  console.log(`Imported to ${importVault(file)}`);
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('sshp')
    .description('Portable encrypted SSH/SFTP picker')
    .version('0.1.0')
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
    if (key !== 'dataDir') throw new Error('Only dataDir is supported.');
    writeBootstrapConfig({ dataDir: value });
    console.log(`dataDir set to ${value}`);
  });

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error(toFriendlyMessage(error));
  process.exitCode = 1;
});
