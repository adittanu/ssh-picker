export class SshpError extends Error {
  constructor(message: string, public readonly code = 'SSHP_ERROR') {
    super(message);
    this.name = 'SshpError';
  }
}

export class MissingVaultError extends SshpError {
  constructor(dataDir: string) {
    super(`No SSHP vault found in ${dataDir}. Run \`sshp init\` first.`, 'MISSING_VAULT');
  }
}

export class VaultExistsError extends SshpError {
  constructor(dataDir: string) {
    super(`A SSHP vault already exists in ${dataDir}.`, 'VAULT_EXISTS');
  }
}

export class InvalidMasterPasswordError extends SshpError {
  constructor() {
    super('Master password is incorrect.', 'INVALID_MASTER_PASSWORD');
  }
}

export class NotFoundError extends SshpError {
  constructor(entity: string, key: string) {
    super(`${entity} not found: ${key}`, 'NOT_FOUND');
  }
}

export function toFriendlyMessage(error: unknown): string {
  if (error instanceof SshpError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}
