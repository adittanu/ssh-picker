import React, { useMemo, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { ServerRecord } from '../../shared/types.js';

export interface DashboardProps {
  servers: ServerRecord[];
  onConnect: (server: ServerRecord) => void;
  onFiles: (server: ServerRecord) => void;
  onQuit?: () => void;
}

export function Dashboard({ servers, onConnect, onFiles, onQuit }: DashboardProps) {
  const { exit } = useApp();
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? servers.filter((server) => server.name.toLowerCase().includes(q) || server.host.toLowerCase().includes(q)) : servers;
  }, [servers, query]);
  const current = filtered[Math.min(selected, Math.max(0, filtered.length - 1))];

  useInput((input, key) => {
    if (searching) {
      if (key.return || key.escape) setSearching(false);
      else if (key.backspace || key.delete) setQuery((value) => value.slice(0, -1));
      else if (input) setQuery((value) => value + input);
      setSelected(0);
      return;
    }

    if (key.upArrow) setSelected((value) => Math.max(0, value - 1));
    if (key.downArrow) setSelected((value) => Math.min(Math.max(0, filtered.length - 1), value + 1));
    if (key.return && current) onConnect(current);
    if ((input === 'f' || input === 'F') && current) onFiles(current);
    if (input === '/') setSearching(true);
    if (input === 'q' || input === 'Q' || key.escape) {
      onQuit?.();
      exit();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Box>
        <Box width="50%" flexDirection="column">
          <Text bold>SSHP</Text>
          {filtered.length === 0 ? <Text color="yellow">No servers. Run sshp add.</Text> : filtered.map((server, index) => (
            <Text key={server.id} color={index === selected ? 'cyan' : undefined}>
              {index === selected ? '› ' : '  '}{server.name} <Text dimColor>{server.username}@{server.host}:{server.port}</Text>
            </Text>
          ))}
        </Box>
        <Box width="50%" flexDirection="column">
          <Text bold>Quick Actions</Text>
          <Text>Enter  Connect SSH</Text>
          <Text>F      File Manager</Text>
          <Text>/      Search</Text>
          <Text>Q/Esc  Quit</Text>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Search: {searching ? query + '█' : (query || 'press /')}</Text>
        <Text dimColor>Vault: unlocked</Text>
      </Box>
    </Box>
  );
}
