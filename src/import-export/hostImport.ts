import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { openMigratedDatabase } from '../db/connection.js';
import { ServerRepository } from '../db/repositories/serverRepository.js';
import type { AuthType, CreateServerInput, VaultContext } from '../shared/types.js';
import { encryptString } from '../vault/crypto.js';

export interface ImportResult {
  imported: number;
  skipped: number;
}

interface HostDraft {
  name: string;
  host: string;
  username: string;
  port: number;
  authType: AuthType;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  defaultRemotePath?: string;
}

export function importOpenSshConfig(file: string, vault: VaultContext): ImportResult {
  const path = expandPath(file);
  const drafts = parseOpenSshConfig(readFileSync(path, 'utf8'), dirname(path));
  return importDrafts(drafts, vault);
}

export function importTermiusCsv(file: string, vault: VaultContext): ImportResult {
  const rows = parseCsv(readFileSync(file, 'utf8'));
  const drafts = rows.flatMap((row) => {
    const get = (names: string[]) => names.map((name) => row[normalizeHeader(name)]).find((value) => value?.trim())?.trim();
    const name = get(['label', 'name', 'host label', 'host']);
    const host = get(['address', 'ip address', 'ip', 'hostname', 'host name', 'host']);
    const username = get(['username', 'user', 'login']) || process.env.USERNAME || process.env.USER || 'root';
    if (!name || !host) return [];
    const privateKey = get(['private key', 'privatekey', 'key', 'identityfile']);
    const password = get(['password']);
    return [{
      name,
      host,
      username,
      port: Number(get(['port', 'ssh port'])) || 22,
      authType: privateKey ? 'private_key' : 'password',
      password,
      privateKey: privateKey && existsSync(expandPath(privateKey)) ? readFileSync(expandPath(privateKey), 'utf8') : privateKey,
      passphrase: get(['passphrase', 'key passphrase']),
      defaultRemotePath: get(['remote path', 'default remote path']) || `/home/${username}`
    } satisfies HostDraft];
  });
  return importDrafts(drafts, vault);
}

function importDrafts(drafts: HostDraft[], vault: VaultContext): ImportResult {
  const db = openMigratedDatabase(vault.dbPath);
  const repo = new ServerRepository(db);
  let imported = 0;
  let skipped = 0;
  try {
    const existing = new Set(repo.list().map((server) => server.name.toLowerCase()));
    for (const draft of drafts) {
      if (existing.has(draft.name.toLowerCase())) {
        skipped++;
        continue;
      }
      repo.create(toCreateInput(draft, vault));
      existing.add(draft.name.toLowerCase());
      imported++;
    }
  } finally {
    db.close();
  }
  return { imported, skipped };
}

function toCreateInput(draft: HostDraft, vault: VaultContext): CreateServerInput {
  return {
    name: draft.name,
    host: draft.host,
    username: draft.username,
    port: draft.port,
    authType: draft.authType,
    encryptedPassword: draft.password ? encryptString(draft.password, vault.key) : null,
    encryptedPrivateKey: draft.privateKey ? encryptString(draft.privateKey, vault.key) : null,
    encryptedPassphrase: draft.passphrase ? encryptString(draft.passphrase, vault.key) : null,
    defaultRemotePath: draft.defaultRemotePath || `/home/${draft.username}`
  };
}

function parseOpenSshConfig(contents: string, baseDir: string): HostDraft[] {
  const drafts: HostDraft[] = [];
  let aliases: string[] = [];
  let options = new Map<string, string>();
  const flush = () => {
    for (const alias of aliases) {
      if (!alias || alias.includes('*') || alias.includes('?')) continue;
      const username = options.get('user') || process.env.USERNAME || process.env.USER || 'root';
      const identityFile = options.get('identityfile');
      const keyPath = identityFile ? expandPath(identityFile, baseDir) : null;
      const privateKey = keyPath && existsSync(keyPath) ? readFileSync(keyPath, 'utf8') : undefined;
      drafts.push({
        name: alias,
        host: options.get('hostname') || alias,
        username,
        port: Number(options.get('port')) || 22,
        authType: privateKey ? 'private_key' : 'password',
        privateKey,
        defaultRemotePath: `/home/${username}`
      });
    }
  };

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '').trim();
    if (!line || line.startsWith('#')) continue;
    const [rawKey, ...rest] = line.split(/\s+/);
    const key = rawKey.toLowerCase();
    const value = rest.join(' ');
    if (key === 'host') {
      flush();
      aliases = value.split(/\s+/);
      options = new Map();
    } else if (aliases.length > 0) {
      options.set(key, value);
    }
  }
  flush();
  return drafts;
}

function parseCsv(contents: string): Array<Record<string, string>> {
  const rows = splitCsvRows(contents).map(parseCsvRow).filter((row) => row.length > 0);
  const headers = rows.shift()?.map(normalizeHeader) ?? [];
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

function splitCsvRows(contents: string): string[] {
  const rows: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < contents.length; index++) {
    const char = contents[index];
    const next = contents[index + 1];
    if (char === '"' && next === '"') {
      current += '""';
      index++;
    } else if (char === '"') quoted = !quoted;
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (current.trim()) rows.push(current);
      current = '';
      if (char === '\r' && next === '\n') index++;
    } else current += char;
  }
  if (current.trim()) rows.push(current);
  return rows;
}

function parseCsvRow(row: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < row.length; index++) {
    const char = row[index];
    const next = row[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index++;
    } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else current += char;
  }
  values.push(current);
  return values;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function expandPath(path: string, baseDir = process.cwd()): string {
  const expanded = path.startsWith('~/') || path === '~' ? join(homedir(), path.slice(2)) : path;
  return isAbsolute(expanded) ? expanded : resolve(baseDir, expanded);
}
