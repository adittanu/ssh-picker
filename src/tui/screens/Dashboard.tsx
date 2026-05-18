import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { ServerRecord } from '../../shared/types.js';

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
  onConnect: (server: ServerRecord) => void;
  onFiles: (server: ServerRecord) => void;
  onTest: (server: ServerRecord) => void | Promise<void>;
  onAdd: (values: ServerFormValues) => void | Promise<void>;
  onEdit: (server: ServerRecord, values: ServerFormValues) => void | Promise<void>;
  onDelete: (server: ServerRecord) => void | Promise<void>;
  onQuit?: () => void;
  active?: boolean;
  status?: string | null;
}

type Mode = 'browse' | 'search' | 'add' | 'edit' | 'delete';
type FormField = keyof ServerFormValues;

type FieldDef = { key: FormField; label: string; secret?: boolean; optionalOnEdit?: boolean };

const baseFormFields: FieldDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'host', label: 'Host' },
  { key: 'username', label: 'Username' },
  { key: 'port', label: 'Port' },
  { key: 'defaultRemotePath', label: 'Remote path' }
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

export function Dashboard({ servers, onConnect, onFiles, onTest, onAdd, onEdit, onDelete, onQuit, active = true, status }: DashboardProps) {
  const { exit } = useApp();
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('browse');
  const [form, setForm] = useState<ServerFormValues>(emptyForm());
  const [fieldIndex, setFieldIndex] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [spinner, setSpinner] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? servers.filter((server) => `${server.name} ${server.username} ${server.host}`.toLowerCase().includes(q)) : servers;
  }, [servers, query]);
  const visibleSelected = Math.min(selected, Math.max(0, filtered.length - 1));
  const current = filtered[visibleSelected];
  const editing = mode === 'edit';

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

  const nextField = () => {
    if (fieldIndex < formFields.length - 1) setFieldIndex((value) => value + 1);
    else void submitForm();
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
    if ((input === 't' || input === 'T') && current) {
      setBusy('Testing connection');
      void Promise.resolve(onTest(current)).finally(() => setBusy(null));
    }
    if (input === 'a' || input === 'A') openAdd();
    if ((input === 'e' || input === 'E') && current) openEdit(current);
    if ((key.delete || key.backspace) && current) setMode('delete');
    if (input === '/') setMode('search');
    if (input === 'q' || input === 'Q' || key.escape) {
      onQuit?.();
      exit();
    }
  }, { isActive: active });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <TopBar servers={servers.length} query={query} />
      <Box marginTop={1}>
        <ServerList servers={filtered} selected={visibleSelected} />
        <Box width="64%" flexDirection="column" paddingLeft={2}>
          {mode === 'add' || mode === 'edit'
            ? <ServerForm mode={mode} form={form} fieldIndex={fieldIndex} busy={busy} spinner={spinner} error={formError} />
            : mode === 'delete' && current
              ? <DeleteConfirm server={current} />
              : <ServerDetails server={current} />}
        </Box>
      </Box>
      <Footer mode={mode} status={status} busy={busy} spinner={spinner} />
    </Box>
  );
}

function TopBar({ servers, query }: { servers: number; query: string }) {
  return <Box justifyContent="space-between">
    <Text><Text bold color="cyan">SSHP</Text> <Text dimColor>Vault unlocked</Text> <Text dimColor>{servers} server{servers === 1 ? '' : 's'}</Text></Text>
    <Text dimColor>{query ? `Search: /${query}` : '/ search'}   A add server</Text>
  </Box>;
}

function ServerList({ servers, selected }: { servers: ServerRecord[]; selected: number }) {
  const height = 14;
  const start = Math.min(Math.max(0, selected - Math.floor(height / 2)), Math.max(0, servers.length - height));
  const visible = servers.slice(start, start + height);
  return <Box width="36%" flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
    <Text bold color="cyan">Servers <Text dimColor>{servers.length ? `${start + 1}-${start + visible.length}/${servers.length}` : '0/0'}</Text></Text>
    {servers.length === 0 ? (
      <Box flexDirection="column" marginTop={1}>
        <Text color="yellow">No servers yet</Text>
        <Text dimColor>Press A to add your first host</Text>
      </Box>
    ) : visible.map((server, index) => {
      const absoluteIndex = start + index;
      return <Text key={server.id} color={absoluteIndex === selected ? 'cyan' : undefined}>
        {absoluteIndex === selected ? '> ' : '  '}{truncate(server.name, 28)}
      </Text>
    })}
  </Box>;
}

function ServerDetails({ server }: { server?: ServerRecord }) {
  if (!server) {
    return <Box flexDirection="column">
      <Text bold color="cyan">Welcome</Text>
      <Text>No server selected.</Text>
      <Text dimColor>Press A to add a host.</Text>
    </Box>;
  }

  return <Box flexDirection="column">
    <Text bold color="cyan">{server.name}</Text>
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
      <Text bold color="cyan">Actions</Text>
      <Text><Text color="green">Enter</Text> SSH   <Text color="green">F</Text> Files   <Text color="green">T</Text> Test</Text>
      <Text><Text color="green">E</Text> Edit      <Text color="green">Del</Text> Delete  <Text color="green">A</Text> Add</Text>
    </Box>
  </Box>;
}

function ServerForm({ mode, form, fieldIndex, busy, spinner, error }: { mode: Mode; form: ServerFormValues; fieldIndex: number; busy: string | null; spinner: number; error: string | null }) {
  const formFields = activeFormFields(form);
  return <Box flexDirection="column">
    <Text bold color="cyan">{mode === 'add' ? 'Add server' : 'Edit server'}</Text>
    <Text dimColor>{mode === 'edit' ? 'Leave password empty to keep the current password.' : 'Follow the fields, then press Enter to save.'}</Text>
    <Box marginTop={1} flexDirection="column">
      {formFields.map((field, index) => {
        const value = form[field.key];
        const visible = field.secret ? '*'.repeat(String(value).length) : String(value);
        return <Text key={field.key} color={index === fieldIndex ? 'cyan' : undefined}>
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
    ? 'Up/Down select  / search  Q quit'
    : mode === 'search'
      ? 'Search servers  Enter apply  Esc clear'
      : mode === 'delete'
        ? 'Y confirm  N/Esc cancel'
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
