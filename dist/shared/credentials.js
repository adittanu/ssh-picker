import { decryptString } from '../vault/crypto.js';
export function decryptServerCredentials(server, vault) {
    return {
        password: server.encryptedPassword ? decryptString(server.encryptedPassword, vault.key) : undefined,
        privateKey: server.encryptedPrivateKey ? decryptString(server.encryptedPrivateKey, vault.key) : undefined,
        passphrase: server.encryptedPassphrase ? decryptString(server.encryptedPassphrase, vault.key) : undefined
    };
}
//# sourceMappingURL=credentials.js.map