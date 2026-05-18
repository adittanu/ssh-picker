import React, { useState } from 'react';
import { Text } from 'ink';
import { openVaultDatabase } from '../vault/vault.js';
import { ServerRepository } from '../db/repositories/serverRepository.js';
import type { ServerRecord, VaultContext } from '../shared/types.js';
import { Dashboard } from './screens/Dashboard.js';
import { FileManager } from './screens/FileManager.js';
import { decryptServerCredentials } from '../shared/credentials.js';
import { connectSsh } from '../ssh/client.js';
import { toFriendlyMessage } from '../shared/errors.js';

export interface AppProps {
  vault: VaultContext;
}

export function App({ vault }: AppProps) {
  const [screen, setScreen] = useState<'dashboard' | 'files'>('dashboard');
  const [selectedServer, setSelectedServer] = useState<ServerRecord | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const db = openVaultDatabase(vault);
  const servers = new ServerRepository(db).list();
  db.close();

  if (screen === 'files' && selectedServer) {
    return <FileManager server={selectedServer} vault={vault} onBack={() => setScreen('dashboard')} />;
  }

  return <>
    <Dashboard
      servers={servers}
      onConnect={(server) => {
        setStatus(`Connecting to ${server.name}...`);
        connectSsh({ server, credentials: decryptServerCredentials(server, vault) })
          .catch((error) => setStatus(toFriendlyMessage(error)));
      }}
      onFiles={(server) => { setSelectedServer(server); setScreen('files'); }}
    />
    {status ? <Text color="yellow">{status}</Text> : null}
  </>;
}
