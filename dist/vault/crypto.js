import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
export const KDF = 'scrypt';
export const CIPHER = 'aes-256-gcm';
export const KEY_LENGTH = 32;
export const SCRYPT_OPTIONS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export function generateSalt() {
    return randomBytes(16).toString('base64');
}
export function deriveKey(masterPassword, saltBase64) {
    return scryptSync(masterPassword, Buffer.from(saltBase64, 'base64'), KEY_LENGTH, SCRYPT_OPTIONS);
}
export function encryptString(plaintext, key) {
    const iv = randomBytes(12);
    const cipher = createCipheriv(CIPHER, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const value = {
        version: 1,
        algorithm: CIPHER,
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        ciphertext: ciphertext.toString('base64')
    };
    return JSON.stringify(value);
}
export function decryptString(serialized, key) {
    const value = JSON.parse(serialized);
    if (value.version !== 1 || value.algorithm !== CIPHER) {
        throw new Error('Unsupported encrypted value format.');
    }
    const decipher = createDecipheriv(CIPHER, key, Buffer.from(value.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
    const plaintext = Buffer.concat([
        decipher.update(Buffer.from(value.ciphertext, 'base64')),
        decipher.final()
    ]);
    return plaintext.toString('utf8');
}
export function safeEquals(a, b) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
}
//# sourceMappingURL=crypto.js.map