export type AuthType = 'password' | 'private_key';

export interface EncryptedValue {
  version: 1;
  algorithm: 'aes-256-gcm';
  iv: string;
  tag: string;
  ciphertext: string;
}

export interface VaultContext {
  dataDir: string;
  dbPath: string;
  key: Buffer;
}

export interface ServerRecord {
  id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  encryptedPassword: string | null;
  encryptedPrivateKey: string | null;
  encryptedPassphrase: string | null;
  tags: string | null;
  notes: string | null;
  defaultRemotePath: string | null;
  lastConnectedAt: string | null;
  connectionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServerInput {
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  encryptedPassword?: string | null;
  encryptedPrivateKey?: string | null;
  encryptedPassphrase?: string | null;
  tags?: string | null;
  notes?: string | null;
  defaultRemotePath?: string | null;
}

export interface ServerCredentials {
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface LocalForwardConfig {
  localHost: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt?: Date;
}
