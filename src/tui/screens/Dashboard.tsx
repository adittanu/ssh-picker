import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { useMouse } from 'ink-use-mouse';
import type { LocalForwardConfig, ServerRecord } from '../../shared/types.js';
import type { AppSettings } from '../../config/settings.js';

export interface ServerFormValues {
  name: string;
  host: string;
  username: string;
  port: number;
  authType: 'password' | 'private_key';
  password: string;
  privateKeyPath: string;
  passphrase: string;
  defaultRemotePath: string;
}

export interface DashboardProps {
  servers: ServerRecord[];
  settings: AppSettings;
  onConnect: (server: ServerRecord) => void;
  onFiles: (server: ServerRecord) => void;
  onForward: (server: ServerRecord, forward: LocalForwardConfig) => void | Promise<void>;
  onTest: (server: ServerRecord) => void | Promise<void>;
  onAdd: (values: ServerFormValues) => void | Promise<void>;
  onEdit: (server: ServerRecord, values: ServerFormValues) => void | Promise<void>;
  onDelete: (server: ServerRecord) => void | Promise<void>;
  onSettings?: () => void;
  onQuit?: () => void;
  active?: boolean;
  status?: string | null;
}

type Mode = 'browse' | 'search' | 'add' | 'edit' | 'delete' | 'forward';
type FormField = keyof ServerFormValues;
type ForwardField = 'localPort' | 'remoteHost' | 'remotePort';

type FieldDef = { key: FormField; label: string; secret?: boolean; optionalOnEdit?: boolean };
type ForwardFieldDef = { key: ForwardField; label: string };

const baseFormFields: FieldDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'host', label: 'Host' },
  { key: 'username', label: 'Username' },
  { key: 'port', label: 'Port' },
  { key: 'defaultRemotePath', label: 'Remote path' }
];

const forwardFields: ForwardFieldDef[] = [
  { key: 'localPort', label: 'Local port' },
  { key: 'remoteHost', label: 'Remote host' },
  { key: 'remotePort', label: 'Remote port' }
];

function activeFormFields(form: ServerFormValues): FieldDef[] {
  const credentialFields: FieldDef[] = form.authType === 'private_key'
    ? [
      { key: 'privateKeyPath', label: 'Key path', optionalOnEdit: true },
      { key: 'passphrase', label: 'Passphrase', secret: true, optionalOnEdit: true }
    ]
    : [{ key: 'password', label: 'Password', secret: true, optionalOnEdit: true }];
  return [...baseFormFields.slice(0, 4), { key: 'authType', label: 'Auth' }, ...credentialFields, baseFormFields[4]];
}

const spinnerFrames = ['-', '\\', '|', '/'];

function emptyForm(): ServerFormValues {
  return { name: '', host: '', username: '', port: 22, authType: 'password', password: '', privateKeyPath: '', passphrase: '', defaultRemotePath: '/home/' };
}

function defaultForwardForm(): LocalForwardConfig {
  return { localHost: '127.0.0.1', localPort: 8080, remoteHost: '127.0.0.1', remotePort: 80 };
}

function editForm(server: ServerRecord): ServerFormValues {
  return {
    name: server.name,
    host: server.host,
    username: server.username,
    port: server.port,
    authType: server.authType,
    password: '',
    privateKeyPath: '',
    passphrase: '',
    defaultRemotePath: server.defaultRemotePath || `/home/${server.username}`
  };
}

// Layout constants for mouse hit testing
const LIST_START_ROW = 4; // TopBar(1) + margin(1) + border(1) + header(1)
const LIST_HEIGHT = 14;

export function Dashboard({ servers, settings, onConnect, onFiles, onForward, onTest, onAdd, onEdit, onDelete, onSettings, onQuit, active = true, status }: DashboardProps) {
  const { exit } = useApp();
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('browse');
  const [form, setForm] = useState<ServerFormValues>(emptyForm());
  const [forwardForm, setForwardForm] = useState<LocalForwardConfig>(defaultForwardForm());
  const [fieldIndex, setFieldIndex] = useState(0);
  const [forwardFieldIndex, setForwardFieldIndex] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [forwardError, setForwardError] = useState<string | null>(null);
  const [spinner, setSpinner] = useState(0);
  const lastMouseEvent = useRef<{ x: number; y: number; type: string } | null>(null);

  const mouse = useMouse();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? servers.filter((server) => `${server.name} ${server.username} ${server.host}`.toLowerCase().includes(q)) : servers;
  }, [servers, query]);
  const visibleSelected = Math.min(selected, Math.max(0, filtered.length - 1));
  const current = filtered[visibleSelected];
  const editing = mode === 'edit';

  // Calculate list viewport start for mouse mapping
  const listStart = Math.min(Math.max(0, visibleSelected - Math.floor(LIST_HEIGHT / 2)), Math.max(0, filtered.length - LIST_HEIGHT));

  // Mouse interaction handling
  useEffect(() => {
    if (!active || mode !== 'browse' || busy) return;
    const { x, y, type, button } = mouse;
    const eventKey = `${x},${y},${type}`;
    if (lastMouseEvent.current && lastMouseEvent.current.x === x && lastMouseEvent.current.y === y && lastMouseEvent.current.type === type) return;
    lastMouseEvent.current = { x, y, type };

    // Scroll wheel in server list area
    if (type === 'scroll-up') {
      setSelected((value) => Math.max(0, value - 1));
      return;
    }
    if (type === 'scroll-down') {
      setSelected((value) => Math.min(Math.max(0, filtered.length - 1), value + 1));
      return;
    }

    // Click in server list area (left ~36% of width, rows after header)
    if (type === 'press' && button === 'left') {
      // Server list occupies roughly columns 1-30, rows LIST_START_ROW to LIST_START_ROW+LIST_HEIGHT
      if (x >= 1 && x <= 34 && y >= LIST_START_ROW && y < LIST_START_ROW + LIST_HEIGHT) {
        const clickedIndex = listStart + (y - LIST_START_ROW);
        if (clickedIndex >= 0 && clickedIndex < filtered.length) {
          setSelected(clickedIndex);
        }
      }
    }
  }, [mouse.x, mouse.y, mouse.type, mouse.button, active, mode, busy, filtered.length, listStart]);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setSpinner((value) => value + 1), 120);
    return () => clearInterval(timer);
  }, [busy]);

  const openAdd = () => {
    setForm(emptyForm());
    setFieldIndex(0);
    setFormError(null);
    setMode('add');
  };

  const openEdit = (server: ServerRecord) => {
    setForm(editForm(server));
    setFieldIndex(0);
    setFormError(null);
    setMode('edit');
  };

  const openForward = () => {
    setForwardForm(defaultForwardForm());
    setForwardFieldIndex(0);
    setForwardError(null);
    setMode('forward');
  };

  const closeMode = () => {
    setMode('browse');
    setBusy(null);
  };

  const setFormField = (value: string) => {
    const field = formFields[fieldIndex]?.key;
    if (!field) return;
    setFormError(null);
    setForm((currentForm) => ({ ...currentForm, [field]: field === 'port' ? Number(value) || 0 : field === 'authType' ? normalizeAuthType(value) : value }));
  };

  const currentValue = () => String(form[formFields[fieldIndex]?.key ?? 'name']);

  const appendInput = (input: string) => {
    const field = formFields[fieldIndex]?.key;
    if (field === 'port' && !/^\d+$/.test(input)) return;
    if (field === 'authType') {
      setFormField(input.toLowerCase() === 'k' ? 'private_key' : 'password');
      return;
    }
    setFormField(currentValue() + input);
  };

  const deleteInput = () => {
    setFormField(currentValue().slice(0, -1));
  };

  const setForwardField = (value: string) => {
    const field = forwardFields[forwardFieldIndex]?.key;
    if (!field) return;
    setForwardError(null);
    setForwardForm((currentForm) => ({
      ...currentForm,
      [field]: field === 'remoteHost' ? value : Number(value) || 0
    }));
  };

  const currentForwardValue = () => String(forwardForm[forwardFields[forwardFieldIndex]?.key ?? 'localPort']);

  const appendForwardInput = (input: string) => {
    const field = forwardFields[forwardFieldIndex]?.key;
    if (field !== 'remoteHost' && !/^\d+$/.test(input)) return;
    setForwardField(currentForwardValue() + input);
  };

  const deleteForwardInput = () => {
    setForwardField(currentForwardValue().slice(0, -1));
  };

  const submitForm = async () => {
    const validation = validateForm(form, editing);
    if (validation !== true) {
      setFormError(validation);
      return;
    }
    setBusy(mode === 'add' ? 'Saving server' : 'Updating server');
    try {
      if (mode === 'add') await onAdd(form);
      else if (mode === 'edit' && current) await onEdit(current, form);
      closeMode();
    } finally {
      setBusy(null);
    }
  };

  const submitForwardForm = async () => {
    const validation = validateForwardForm(forwardForm);
    if (validation !== true) {
      setForwardError(validation);
      return;
    }
    if (!current) return;
    setBusy('Starting forward');
    try {
      await onForward(current, forwardForm);
      closeMode();
    } finally {
      setBusy(null);
    }
  };

  const nextField = () => {
    if (fieldIndex < formFields.length - 1) setFieldIndex((value) => value + 1);
    else void submitForm();
  };

  const nextForwardField = () => {
    if (forwardFieldIndex < forwardFields.length - 1) setForwardFieldIndex((value) => value + 1);
    else void submitForwardForm();
  };

  const formFields = activeFormFields(form);

  useInput((input, key) => {
    if (busy) return;

    if (mode === 'search') {
      if (key.return) setMode('browse');
      else if (key.escape) { setQuery(''); setMode('browse'); }
      else if (key.backspace || key.delete) setQuery((value) => value.slice(0, -1));
      else if (input) { setQuery((value) => value + input); setSelected(0); }
      return;
    }

    if (mode === 'add' || mode === 'edit') {
      if (key.escape) closeMode();
      else if (key.return || key.tab) nextField();
      else if (key.upArrow) setFieldIndex((value) => Math.max(0, value - 1));
      else if (key.downArrow) setFieldIndex((value) => Math.min(formFields.length - 1, value + 1));
      else if (key.backspace || key.delete) deleteInput();
      else if (input) appendInput(input);
      return;
    }

    if (mode === 'forward') {
      if (key.escape) closeMode();
      else if (key.return || key.tab) nextForwardField();
      else if (key.upArrow) setForwardFieldIndex((value) => Math.max(0, value - 1));
      else if (key.downArrow) setForwardFieldIndex((value) => Math.min(forwardFields.length - 1, value + 1));
      else if (key.backspace || key.delete) deleteForwardInput();
      else if (input) appendForwardInput(input);
      return;
    }

    if (mode === 'delete') {
      if ((input === 'y' || input === 'Y') && current) {
        setBusy('Deleting server');
        void Promise.resolve(onDelete(current)).finally(() => closeMode());
      } else if (input === 'n' || input === 'N' || key.escape) {
        closeMode();
      }
      return;
    }

    if (key.upArrow) setSelected((value) => Math.max(0, value - 1));
    if (key.downArrow) setSelected((value) => Math.min(Math.max(0, filtered.length - 1), value + 1));
    if (key.return && current) onConnect(current);
    if ((input === 'f' || input === 'F') && current) onFiles(current);
    if ((input === 'p' || input === 'P') && current) openForward();
    if ((input === 't' || input === 'T') && current) {
      setBusy('Testing connection');
      void Promise.resolve(onTest(current)).finally(() => setBusy(null));
    }
    if (input === 'a' || input === 'A') openAdd();
    if ((input === 'e' || input === 'E') && current) openEdit(current);
    if ((key.delete || key.backspace) && current) setMode('delete');
    if (input === '/') setMode('search');
    if (input === 's' || input === 'S') { onSettings?.(); return; }
    if (input === 'q' || input === 'Q' || key.escape) {
      onQuit?.();
      exit();
    }
  }, { isActive: active });

  const accent = settings.accentColor;
  const termWidth = process.stdout.columns || 80;
  const isWide = termWidth >= 90;

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <TopBar servers={servers.length} query={query} accent={accent} />
      {settings.layout === 'card' ? (
        isWide ? (
          <Box marginTop={1}>
            <ServerCardGrid servers={filtered} selected={visibleSelected} accent={accent} />
            <Box width="50%" flexDirection="column" paddingLeft={2}>
              {mode === 'add' || mode === 'edit'
                ? <ServerForm mode={mode} form={form} fieldIndex={fieldIndex} busy={busy} spinner={spinner} error={formError} accent={accent} />
                : mode === 'forward'
                  ? <ForwardForm form={forwardForm} fieldIndex={forwardFieldIndex} busy={busy} spinner={spinner} error={forwardError} accent={accent} />
                : mode === 'delete' && current
                  ? <DeleteConfirm server={current} />
                  : <ServerDetails server={current} accent={accent} />}
            </Box>
          </Box>
        ) : (
          <Box marginTop={1} flexDirection="column">
            <ServerCardGrid servers={filtered} selected={visibleSelected} accent={accent} />
            <Box marginTop={1}>
              {mode === 'add' || mode === 'edit'
                ? <ServerForm mode={mode} form={form} fieldIndex={fieldIndex} busy={busy} spinner={spinner} error={formError} accent={accent} />
                : mode === 'forward'
                  ? <ForwardForm form={forwardForm} fieldIndex={forwardFieldIndex} busy={busy} spinner={spinner} error={forwardError} accent={accent} />
                : mode === 'delete' && current
                  ? <DeleteConfirm server={current} />
                  : <CompactServerInfo server={current} accent={accent} />}
            </Box>
          </Box>
        )
      ) : (
        <Box marginTop={1}>
          <ServerList servers={filtered} selected={visibleSelected} accent={accent} />
          <Box width="64%" flexDirection="column" paddingLeft={2}>
            {mode === 'add' || mode === 'edit'
              ? <ServerForm mode={mode} form={form} fieldIndex={fieldIndex} busy={busy} spinner={spinner} error={formError} accent={accent} />
              : mode === 'forward'
                ? <ForwardForm form={forwardForm} fieldIndex={forwardFieldIndex} busy={busy} spinner={spinner} error={forwardError} accent={accent} />
              : mode === 'delete' && current
                ? <DeleteConfirm server={current} />
                : <ServerDetails server={current} accent={accent} />}
          </Box>
        </Box>
      )}
      <Footer mode={mode} status={status} busy={busy} spinner={spinner} />
    </Box>
  );
}

function TopBar({ servers, query, accent }: { servers: number; query: string; accent: string }) {
  return <Box justifyContent="space-between">
    <Text><Text bold color={accent}>SSHP</Text> <Text dimColor>Vault unlocked</Text> <Text dimColor>{servers} server{servers === 1 ? '' : 's'}</Text></Text>
    <Text dimColor>{query ? `Search: /${query}` : '/ search'}   A add server</Text>
  </Box>;
}

function ServerList({ servers, selected, accent }: { servers: ServerRecord[]; selected: number; accent: string }) {
  const height = 14;
  const start = Math.min(Math.max(0, selected - Math.floor(height / 2)), Math.max(0, servers.length - height));
  const visible = servers.slice(start, start + height);
  return <Box width="36%" flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
    <Text bold color={accent}>Servers <Text dimColor>{servers.length ? `${start + 1}-${start + visible.length}/${servers.length}` : '0/0'}</Text></Text>
    {servers.length === 0 ? (
      <Box flexDirection="column" marginTop={1}>
        <Text color="yellow">No servers yet</Text>
        <Text dimColor>Press A to add your first host</Text>
      </Box>
    ) : visible.map((server, index) => {
      const absoluteIndex = start + index;
      return <Text key={server.id} color={absoluteIndex === selected ? accent : undefined}>
        {absoluteIndex === selected ? '> ' : '  '}{truncate(server.name, 28)}
      </Text>
    })}
  </Box>;
}

function ServerCardGrid({ servers, selected, accent }: { servers: ServerRecord[]; selected: number; accent: string }) {
  const visibleCount = 5;
  const start = Math.min(
    Math.max(0, selected - Math.floor(visibleCount / 2)),
    Math.max(0, servers.length - visibleCount)
  );
  const visible = servers.slice(start, start + visibleCount);

  return <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor="gray" paddingX={1}>
    <Text bold color={accent}>Servers <Text dimColor>{servers.length ? `${start + 1}-${start + visible.length}/${servers.length}` : '0/0'}</Text></Text>
    {servers.length === 0 ? (
      <Box flexDirection="column" marginTop={1}>
        <Text color="yellow">No servers yet</Text>
        <Text dimColor>Press A to add your first host</Text>
      </Box>
    ) : visible.map((server) => {
      const absIdx = servers.indexOf(server);
      const isSelected = absIdx === selected;
      return <Box
        key={server.id}
        borderStyle={isSelected ? 'bold' : 'single'}
        borderColor={isSelected ? accent : 'gray'}
        paddingX={1}
        flexDirection="column"
      >
        <Text bold color={isSelected ? accent : 'white'}>{truncate(server.name, 24)}</Text>
        <Text dimColor>{server.username}@{truncate(server.host, 16)}:{server.port}</Text>
      </Box>;
    })}
  </Box>;
}

function CompactServerInfo({ server, accent }: { server?: ServerRecord; accent: string }) {
  if (!server) return <Text dimColor>Press A to add a host.</Text>;
  return <Box flexDirection="column">
    <Text bold color={accent}>{server.name}</Text>
    <Text dimColor>{server.username}@{server.host}:{server.port}  {server.connectionCount} conn  Last: {formatDate(server.lastConnectedAt)}</Text>
    <Text><Text color="green">Enter</Text> SSH  <Text color="green">F</Text> Files  <Text color="green">P</Text> Forward  <Text color="green">T</Text> Test  <Text color="green">E</Text> Edit  <Text color="green">Del</Text> Delete  <Text color="green">A</Text> Add</Text>
  </Box>;
}

function ServerDetails({ server, accent }: { server?: ServerRecord; accent: string }) {
  if (!server) {
    return <Box flexDirection="column">
      <Text bold color="cyan">Welcome</Text>
      <Text>No server selected.</Text>
      <Text dimColor>Press A to add a host.</Text>
    </Box>;
  }

  return <Box flexDirection="column">
    <Text bold color={accent}>{server.name}</Text>
    <Text>{server.username}@{server.host}:{server.port}</Text>
    <Box marginTop={1} flexDirection="column">
      <Text dimColor>Default remote</Text>
      <Text>{server.defaultRemotePath || '~'}</Text>
    </Box>
    <Box marginTop={1} flexDirection="column">
      <Text dimColor>Usage</Text>
      <Text>{server.connectionCount} connection{server.connectionCount === 1 ? '' : 's'} <Text dimColor>Last: {formatDate(server.lastConnectedAt)}</Text></Text>
    </Box>
    <Box marginTop={1} flexDirection="column">
      <Text bold color={accent}>Actions</Text>
      <Text><Text color="green">Enter</Text> SSH   <Text color="green">F</Text> Files   <Text color="green">P</Text> Forward</Text>
      <Text><Text color="green">T</Text> Test      <Text color="green">E</Text> Edit    <Text color="green">Del</Text> Delete  <Text color="green">A</Text> Add</Text>
    </Box>
  </Box>;
}

function ServerForm({ mode, form, fieldIndex, busy, spinner, error, accent }: { mode: Mode; form: ServerFormValues; fieldIndex: number; busy: string | null; spinner: number; error: string | null; accent: string }) {
  const formFields = activeFormFields(form);
  return <Box flexDirection="column">
    <Text bold color={accent}>{mode === 'add' ? 'Add server' : 'Edit server'}</Text>
    <Text dimColor>{mode === 'edit' ? 'Leave password empty to keep the current password.' : 'Follow the fields, then press Enter to save.'}</Text>
    <Box marginTop={1} flexDirection="column">
      {formFields.map((field, index) => {
        const value = form[field.key];
        const visible = field.secret ? '*'.repeat(String(value).length) : String(value);
        return <Text key={field.key} color={index === fieldIndex ? accent : undefined}>
          {index === fieldIndex ? '> ' : '  '}{field.label}: {visible || (field.optionalOnEdit && mode === 'edit' ? '<keep current>' : '')}
        </Text>;
      })}
    </Box>
    <Box marginTop={1}>
      <Text dimColor>{busy ? `${spinnerFrames[spinner % spinnerFrames.length]} ${busy}...` : 'Enter next/save  Up/Down field  Esc cancel'}</Text>
    </Box>
    {error ? <Text color="yellow">{error}</Text> : null}
  </Box>;
}

function ForwardForm({ form, fieldIndex, busy, spinner, error, accent }: { form: LocalForwardConfig; fieldIndex: number; busy: string | null; spinner: number; error: string | null; accent: string }) {
  return <Box flexDirection="column">
    <Text bold color={accent}>Port forwarding</Text>
    <Text dimColor>Forward localhost through the selected SSH server.</Text>
    <Box marginTop={1} flexDirection="column">
      {forwardFields.map((field, index) => {
        const value = form[field.key];
        return <Text key={field.key} color={index === fieldIndex ? accent : undefined}>
          {index === fieldIndex ? '> ' : '  '}{field.label}: {String(value)}
        </Text>;
      })}
    </Box>
    <Box marginTop={1}>
      <Text dimColor>{busy ? `${spinnerFrames[spinner % spinnerFrames.length]} ${busy}...` : 'Enter next/start  Up/Down field  Esc cancel'}</Text>
    </Box>
    <Text dimColor>Result: {form.localHost}:{form.localPort}{' -> '}{form.remoteHost}:{form.remotePort}</Text>
    {error ? <Text color="yellow">{error}</Text> : null}
  </Box>;
}

function DeleteConfirm({ server }: { server: ServerRecord }) {
  return <Box flexDirection="column">
    <Text bold color="red">Delete server</Text>
    <Text>Delete "{server.name}"?</Text>
    <Text dimColor>This removes the saved credentials from this vault.</Text>
    <Box marginTop={1}>
      <Text><Text color="red">Y</Text> confirm   <Text color="green">N</Text> cancel</Text>
    </Box>
  </Box>;
}

function Footer({ mode, status, busy, spinner }: { mode: Mode; status?: string | null; busy: string | null; spinner: number }) {
  const help = mode === 'browse'
    ? 'Up/Down/Scroll select  Enter SSH  F files  P forward  / search  S settings  Q quit'
    : mode === 'search'
      ? 'Search servers  Enter apply  Esc clear'
      : mode === 'delete'
        ? 'Y confirm  N/Esc cancel'
        : mode === 'forward'
          ? 'Enter next/start forward  Up/Down field  Esc cancel'
        : 'Enter next/save  Up/Down field  Esc cancel';
  return <Box marginTop={1} flexDirection="column">
    <Text dimColor>{help}</Text>
    <Text color={statusColor(status)}>{busy ? `${spinnerFrames[spinner % spinnerFrames.length]} ${busy}...` : `Status: ${status || 'Ready'}`}</Text>
  </Box>;
}

function statusColor(status?: string | null): 'green' | 'red' | 'gray' {
  if (!status) return 'gray';
  return status.toLowerCase().includes('failed') ? 'red' : 'green';
}

function validateForm(form: ServerFormValues, editing: boolean): true | string {
  if (!form.name.trim()) return 'Name is required.';
  if (!form.host.trim()) return 'Host is required.';
  if (!form.username.trim()) return 'Username is required.';
  if (form.authType === 'password' && !editing && !form.password.trim()) return 'Password is required.';
  if (form.authType === 'private_key' && !editing && !form.privateKeyPath.trim()) return 'Private key path is required.';
  if (!form.defaultRemotePath.trim()) return 'Remote path is required.';
  if (!Number.isInteger(form.port) || form.port <= 0 || form.port > 65_535) return 'Port must be between 1 and 65535.';
  return true;
}

function validateForwardForm(form: LocalForwardConfig): true | string {
  if (!Number.isInteger(form.localPort) || form.localPort <= 0 || form.localPort > 65_535) return 'Local port must be between 1 and 65535.';
  if (!form.remoteHost.trim()) return 'Remote host is required.';
  if (!Number.isInteger(form.remotePort) || form.remotePort <= 0 || form.remotePort > 65_535) return 'Remote port must be between 1 and 65535.';
  return true;
}

function formatDate(value: string | null): string {
  if (!value) return 'never';
  return new Date(value).toLocaleString();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function normalizeAuthType(value: string): 'password' | 'private_key' {
  const normalized = value.trim().toLowerCase().replace(/[- ]/g, '_');
  return normalized === 'key' || normalized === 'private_key' ? 'private_key' : 'password';
}
