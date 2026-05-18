import React, { useEffect, useState } from 'react';
import { useApp } from 'ink';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { openVaultDatabase } from '../vault/vault.js';
import { ServerRepository } from '../db/repositories/serverRepository.js';
import type { ServerRecord, VaultContext } from '../shared/types.js';
import { encryptString } from '../vault/crypto.js';
import { decryptServerCredentials } from '../shared/credentials.js';
import { toFriendlyMessage } from '../shared/errors.js';
import { Dashboard, type ServerFormValues } from './screens/Dashboard.js';
import { FileManager } from './screens/FileManager.js';

export interface AppProps {
  vault: VaultContext;
}

export type AppExitResult = { action: 'connect'; server: ServerRecord } | undefined;

function loadServers(vault: VaultContext): ServerRecord[] {
  const db = openVaultDatabase(vault);
  try {
    return new ServerRepository(db).list();
  } finally {
    db.close();
  }
}

function readPrivateKey(path: string): string | null {
  if (!path.trim()) return null;
  const expanded = path === '~' || path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
  return readFileSync(expanded, 'utf8');
}

export function App({ vault }: AppProps) {
  const { exit } = useApp();
  const [screen, setScreen] = useState<'dashboard' | 'files'>('dashboard');
  const [selectedServer, setSelectedServer] = useState<ServerRecord | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [servers, setServers] = useState<ServerRecord[]>(() => loadServers(vault));
  const refreshServers = () => setServers(loadServers(vault));

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 4_000);
    return () => clearTimeout(timer);
  }, [status]);

  if (screen === 'files' && selectedServer) {
    return <FileManager server={selectedServer} vault={vault} onBack={() => setScreen('dashboard')} />;
  }

  return <>
    <Dashboard
      servers={servers}
      status={status}
      onConnect={(server) => {
        setStatus(`Opening SSH: ${server.name}`);
        exit({ action: 'connect', server } satisfies AppExitResult);
      }}
      onFiles={(server) => { setSelectedServer(server); setScreen('files'); }}
      onTest={async (server) => {
        try {
          const { testSshConnection } = await import('../ssh/client.js');
          const result = await testSshConnection({ server, credentials: decryptServerCredentials(server, vault) });
          setStatus(`Connection OK: ${server.name} (${result.elapsedMs}ms)`);
        } catch (error) {
          setStatus(`Connection failed: ${toFriendlyMessage(error)}`);
        }
      }}
      onAdd={(values) => {
        const db = openVaultDatabase(vault);
        try {
          new ServerRepository(db).create({
            name: values.name,
            host: values.host,
            username: values.username,
            port: values.port,
            authType: values.authType,
            encryptedPassword: values.authType === 'password' && values.password ? encryptString(values.password, vault.key) : null,
            encryptedPrivateKey: values.authType === 'private_key' ? encryptString(readPrivateKey(values.privateKeyPath) ?? '', vault.key) : null,
            encryptedPassphrase: values.authType === 'private_key' && values.passphrase ? encryptString(values.passphrase, vault.key) : null,
            defaultRemotePath: values.defaultRemotePath
          });
          setStatus(`Saved ${values.name}`);
        } finally {
          db.close();
        }
        refreshServers();
      }}
      onEdit={(server, values) => {
        const db = openVaultDatabase(vault);
        try {
          new ServerRepository(db).update(server.id, {
            name: values.name,
            host: values.host,
            username: values.username,
            port: values.port,
            authType: values.authType,
            encryptedPassword: values.authType === 'password'
              ? (values.password ? encryptString(values.password, vault.key) : server.encryptedPassword)
              : null,
            encryptedPrivateKey: values.authType === 'private_key'
              ? (values.privateKeyPath ? encryptString(readPrivateKey(values.privateKeyPath) ?? '', vault.key) : server.encryptedPrivateKey)
              : null,
            encryptedPassphrase: values.authType === 'private_key'
              ? (values.passphrase ? encryptString(values.passphrase, vault.key) : server.encryptedPassphrase)
              : null,
            defaultRemotePath: values.defaultRemotePath
          });
          setStatus(`Updated ${values.name}`);
        } finally {
          db.close();
        }
        refreshServers();
      }}
      onDelete={(server) => {
        const db = openVaultDatabase(vault);
        try {
          new ServerRepository(db).remove(server.id);
          setStatus(`Deleted ${server.name}`);
        } finally {
          db.close();
        }
        refreshServers();
      }}
    />
  </>;
}
