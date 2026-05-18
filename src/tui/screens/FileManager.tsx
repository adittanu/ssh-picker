import React, { useEffect, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { cwd } from 'node:process';
import { dirname, join, posix } from 'node:path';
import { listLocalDirectory, SftpClient } from '../../sftp/client.js';
import { decryptServerCredentials } from '../../shared/credentials.js';
import type { DirectoryEntry, ServerRecord, VaultContext } from '../../shared/types.js';
import { toFriendlyMessage } from '../../shared/errors.js';

export interface FileManagerProps {
  server: ServerRecord;
  vault: VaultContext;
  onBack: () => void;
}

type Pane = 'local' | 'remote';
type PendingTransfer = { action: 'upload' | 'download'; entry: DirectoryEntry; target: string };

export function FileManager({ server, vault, onBack }: FileManagerProps) {
  const { exit } = useApp();
  const [pane, setPane] = useState<Pane>('local');
  const [localPath, setLocalPath] = useState(cwd());
  const [remotePath, setRemotePath] = useState(server.defaultRemotePath || '.');
  const [localEntries, setLocalEntries] = useState<DirectoryEntry[]>([]);
  const [remoteEntries, setRemoteEntries] = useState<DirectoryEntry[]>([]);
  const [localSelected, setLocalSelected] = useState(0);
  const [remoteSelected, setRemoteSelected] = useState(0);
  const [status, setStatus] = useState('Connecting SFTP...');
  const [client, setClient] = useState<SftpClient | null>(null);
  const [pendingTransfer, setPendingTransfer] = useState<PendingTransfer | null>(null);

  const refreshLocal = () => {
    try { setLocalEntries(listLocalDirectory(localPath)); } catch (error) { setStatus(toFriendlyMessage(error)); }
  };

  const refreshRemote = async (activeClient = client) => {
    if (!activeClient) return;
    try {
      setRemoteEntries(await activeClient.listRemoteDirectory(remotePath));
      setStatus('Ready');
    } catch (error) { setStatus(toFriendlyMessage(error)); }
  };

  useEffect(() => { refreshLocal(); }, [localPath]);
  useEffect(() => {
    const next = new SftpClient();
    next.connect({ server, credentials: decryptServerCredentials(server, vault) })
      .then(() => { setClient(next); setStatus('Ready'); return next.listRemoteDirectory(remotePath); })
      .then(setRemoteEntries)
      .catch((error) => setStatus(toFriendlyMessage(error)));
    return () => next.close();
  }, []);
  useEffect(() => { void refreshRemote(); }, [remotePath, client]);

  useInput((input, key) => {
    const entries = pane === 'local' ? localEntries : remoteEntries;
    const selected = pane === 'local' ? localSelected : remoteSelected;
    const setSelected = pane === 'local' ? setLocalSelected : setRemoteSelected;
    const current = entries[selected];

    if (pendingTransfer) {
      if ((input === 'y' || input === 'Y') && client) {
        const pending = pendingTransfer;
        setPendingTransfer(null);
        setStatus(`${pending.action === 'upload' ? 'Uploading' : 'Downloading'} ${pending.entry.name}...`);
        const task = pending.action === 'upload'
          ? client.uploadRecursive(pending.entry.path, pending.target, true).then(() => { setStatus('Upload complete'); void refreshRemote(); })
          : (pending.entry.isDirectory ? client.downloadRecursive(pending.entry.path, pending.target, true) : client.downloadFile(pending.entry.path, pending.target, true))
            .then(() => { setStatus('Download complete'); refreshLocal(); });
        task.catch((error) => setStatus(toFriendlyMessage(error)));
      } else if (input === 'n' || input === 'N' || key.escape) {
        setPendingTransfer(null);
        setStatus('Transfer cancelled');
      }
      return;
    }

    if (key.tab) setPane((value) => value === 'local' ? 'remote' : 'local');
    if (key.upArrow) setSelected((value) => Math.max(0, value - 1));
    if (key.downArrow) setSelected((value) => Math.min(Math.max(0, entries.length - 1), value + 1));
    if (key.return && current?.isDirectory) {
      if (pane === 'local') { setLocalPath(current.path); setLocalSelected(0); }
      else { setRemotePath(current.path); setRemoteSelected(0); }
    }
    if (key.backspace) {
      if (pane === 'local') setLocalPath(dirname(localPath));
      else setRemotePath(posix.dirname(remotePath));
    }
    if (input === 'r' || input === 'R') { refreshLocal(); void refreshRemote(); }
    if ((input === 'u' || input === 'U') && client && localEntries[localSelected]) {
      const entry = localEntries[localSelected];
      const target = remotePath.replace(/\/$/, '') + '/' + entry.name;
      setPendingTransfer({ action: 'upload', entry, target });
      setStatus(`Upload ${entry.name} to ${target}? Press Y to confirm overwrite, N to cancel.`);
    }
    if ((input === 'd' || input === 'D') && client && remoteEntries[remoteSelected]) {
      const entry = remoteEntries[remoteSelected];
      const target = join(localPath, entry.name);
      setPendingTransfer({ action: 'download', entry, target });
      setStatus(`Download ${entry.name} to ${target}? Press Y to confirm overwrite, N to cancel.`);
    }
    if (input === 'q' || input === 'Q' || key.escape) { onBack(); exit(); }
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Files: {server.name}</Text>
      <Text>Local:  {localPath}</Text>
      <Text>Remote: {remotePath}</Text>
      <Box marginTop={1}>
        <PaneView title="Local files" active={pane === 'local'} entries={localEntries} selected={localSelected} />
        <PaneView title="Remote files" active={pane === 'remote'} entries={remoteEntries} selected={remoteSelected} />
      </Box>
      <Text dimColor>Tab pane  Enter open  Backspace up  U upload  D download  R refresh  Q quit</Text>
      <Text color={status === 'Ready' ? 'green' : 'yellow'}>{status}</Text>
    </Box>
  );
}

function PaneView({ title, active, entries, selected }: { title: string; active: boolean; entries: DirectoryEntry[]; selected: number }) {
  return <Box width="50%" flexDirection="column" borderStyle={active ? 'single' : undefined} paddingX={1}>
    <Text bold color={active ? 'cyan' : undefined}>{title}</Text>
    {entries.slice(0, 15).map((entry, index) => <Text key={entry.path} color={index === selected ? 'cyan' : undefined}>
      {index === selected ? '› ' : '  '}{entry.name}{entry.isDirectory ? '/' : ''}
    </Text>)}
  </Box>;
}
