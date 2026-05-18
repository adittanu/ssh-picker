import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export const APP_DIR_NAME = '.sshp';
export const DB_FILE_NAME = 'sshp.db';
export const CONFIG_FILE_NAME = 'config.json';

export interface PathResolutionOptions {
  env?: NodeJS.ProcessEnv;
  home?: string;
}

export interface BootstrapConfig {
  dataDir?: string;
}

export function defaultDataDir(home = homedir()): string {
  return join(home, APP_DIR_NAME);
}

export function bootstrapConfigPath(home = homedir()): string {
  return join(defaultDataDir(home), CONFIG_FILE_NAME);
}

export function readBootstrapConfig(home = homedir()): BootstrapConfig {
  const path = bootstrapConfigPath(home);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as BootstrapConfig;
  } catch {
    return {};
  }
}

export function writeBootstrapConfig(config: BootstrapConfig, home = homedir()): void {
  const path = bootstrapConfigPath(home);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export function resolveDataDir(options: PathResolutionOptions = {}): string {
  const env = options.env ?? process.env;
  const home = options.home ?? homedir();
  const explicit = env.SSHP_DATA_DIR;
  if (explicit && explicit.trim()) return resolve(explicit);

  const config = readBootstrapConfig(home);
  if (config.dataDir && config.dataDir.trim()) return resolve(config.dataDir);

  return defaultDataDir(home);
}

export function resolveDbPath(dataDir = resolveDataDir()): string {
  return join(dataDir, DB_FILE_NAME);
}

export function ensureDataDir(dataDir = resolveDataDir()): string {
  mkdirSync(dataDir, { recursive: true });
  return dataDir;
}
