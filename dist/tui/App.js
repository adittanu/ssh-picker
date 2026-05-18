import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Text } from 'ink';
import { openVaultDatabase } from '../vault/vault.js';
import { ServerRepository } from '../db/repositories/serverRepository.js';
import { Dashboard } from './screens/Dashboard.js';
import { FileManager } from './screens/FileManager.js';
import { decryptServerCredentials } from '../shared/credentials.js';
import { connectSsh } from '../ssh/client.js';
import { toFriendlyMessage } from '../shared/errors.js';
export function App({ vault }) {
    const [screen, setScreen] = useState('dashboard');
    const [selectedServer, setSelectedServer] = useState(null);
    const [status, setStatus] = useState(null);
    const db = openVaultDatabase(vault);
    const servers = new ServerRepository(db).list();
    db.close();
    if (screen === 'files' && selectedServer) {
        return _jsx(FileManager, { server: selectedServer, vault: vault, onBack: () => setScreen('dashboard') });
    }
    return _jsxs(_Fragment, { children: [_jsx(Dashboard, { servers: servers, onConnect: (server) => {
                    setStatus(`Connecting to ${server.name}...`);
                    connectSsh({ server, credentials: decryptServerCredentials(server, vault) })
                        .catch((error) => setStatus(toFriendlyMessage(error)));
                }, onFiles: (server) => { setSelectedServer(server); setScreen('files'); } }), status ? _jsx(Text, { color: "yellow", children: status }) : null] });
}
//# sourceMappingURL=App.js.map