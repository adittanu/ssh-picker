export declare const KDF = "scrypt";
export declare const CIPHER = "aes-256-gcm";
export declare const KEY_LENGTH = 32;
export declare const SCRYPT_OPTIONS: {
    readonly N: number;
    readonly r: 8;
    readonly p: 1;
    readonly maxmem: number;
};
export declare function generateSalt(): string;
export declare function deriveKey(masterPassword: string, saltBase64: string): Buffer;
export declare function encryptString(plaintext: string, key: Buffer): string;
export declare function decryptString(serialized: string, key: Buffer): string;
export declare function safeEquals(a: string, b: string): boolean;
