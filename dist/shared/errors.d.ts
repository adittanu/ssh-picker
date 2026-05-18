export declare class SshpError extends Error {
    readonly code: string;
    constructor(message: string, code?: string);
}
export declare class MissingVaultError extends SshpError {
    constructor(dataDir: string);
}
export declare class VaultExistsError extends SshpError {
    constructor(dataDir: string);
}
export declare class InvalidMasterPasswordError extends SshpError {
    constructor();
}
export declare class NotFoundError extends SshpError {
    constructor(entity: string, key: string);
}
export declare function toFriendlyMessage(error: unknown): string;
