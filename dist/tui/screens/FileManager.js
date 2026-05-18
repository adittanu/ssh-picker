import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { useMouse } from 'ink-use-mouse';
import { cwd } from 'node:process';
import { dirname, join, posix } from 'node:path';
import { listLocalDirectory, SftpClient } from '../../sftp/client.js';
import { decryptServerCredentials } from '../../shared/credentials.js';
import { toFriendlyMessage } from '../../shared/errors.js';
// Layout constants for mouse hit testing
const PANE_START_ROW = 5; // header(1) + local path(1) + remote path(1) + margin(1) + border(1)
const PANE_HEIGHT = 15;
export function FileManager({ server, vault, onBack, exitOnBack = false }) {
    const { exit } = useApp();
    const [pane, setPane] = useState('local');
    const [localPath, setLocalPath] = useState(cwd());
    const [remotePath, setRemotePath] = useState(server.defaultRemotePath || '.');
    const [localEntries, setLocalEntries] = useState([]);
    const [remoteEntries, setRemoteEntries] = useState([]);
    const [localSelected, setLocalSelected] = useState(0);
    const [remoteSelected, setRemoteSelected] = useState(0);
    const [status, setStatus] = useState('Connecting SFTP...');
    const [client, setClient] = useState(null);
    const [pendingTransfer, setPendingTransfer] = useState(null);
    const [remoteLoading, setRemoteLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [localQuery, setLocalQuery] = useState('');
    const [remoteQuery, setRemoteQuery] = useState('');
    const [spinner, setSpinner] = useState(0);
    const [activeTransfer, setActiveTransfer] = useState(null);
    const mounted = useRef(true);
    const remoteRequest = useRef(0);
    const lastMouseEvent = useRef(null);
    const termWidth = useRef(process.stdout.columns || 80);
    const mouse = useMouse();
    const localFiltered = useMemo(() => filterEntries(localEntries, localQuery), [localEntries, localQuery]);
    const remoteFiltered = useMemo(() => filterEntries(remoteEntries, remoteQuery), [remoteEntries, remoteQuery]);
    const activeQuery = pane === 'local' ? localQuery : remoteQuery;
    const setActiveQuery = pane === 'local' ? setLocalQuery : setRemoteQuery;
    const safeSetStatus = (message) => {
        if (mounted.current)
            setStatus(message);
    };
    const safeSetTransfer = (progress) => {
        if (!mounted.current)
            return;
        setActiveTransfer((current) => ({ ...progress, startedAt: current?.startedAt ?? Date.now() }));
    };
    const refreshLocal = () => {
        try {
            setLocalEntries(listLocalDirectory(localPath));
        }
        catch (error) {
            safeSetStatus(toFriendlyMessage(error));
        }
    };
    const refreshRemote = async (activeClient = client, path = remotePath) => {
        if (!mounted.current)
            return;
        if (!activeClient) {
            setRemoteLoading(true);
            safeSetStatus('Connecting SFTP...');
            return;
        }
        const requestId = ++remoteRequest.current;
        setRemoteLoading(true);
        safeSetStatus(`Loading remote ${path}...`);
        try {
            const entries = await activeClient.listRemoteDirectory(path);
            if (!mounted.current || requestId !== remoteRequest.current)
                return;
            setRemoteEntries(entries);
            setRemoteSelected(0);
            safeSetStatus('Ready');
        }
        catch (error) {
            if (!mounted.current || requestId !== remoteRequest.current)
                return;
            setRemoteEntries([]);
            safeSetStatus(toFriendlyMessage(error));
        }
        finally {
            if (mounted.current && requestId === remoteRequest.current)
                setRemoteLoading(false);
        }
    };
    // Calculate list viewport starts for mouse mapping
    const localVisibleSelected = Math.min(localSelected, Math.max(0, localFiltered.length - 1));
    const remoteVisibleSelected = Math.min(remoteSelected, Math.max(0, remoteFiltered.length - 1));
    const localListStart = Math.min(Math.max(0, localVisibleSelected - Math.floor(PANE_HEIGHT / 2)), Math.max(0, localFiltered.length - PANE_HEIGHT));
    const remoteListStart = Math.min(Math.max(0, remoteVisibleSelected - Math.floor(PANE_HEIGHT / 2)), Math.max(0, remoteFiltered.length - PANE_HEIGHT));
    // Mouse interaction handling
    useEffect(() => {
        if (pendingTransfer || searching)
            return;
        const { x, y, type, button } = mouse;
        const eventKey = `${x},${y},${type}`;
        if (lastMouseEvent.current && lastMouseEvent.current.x === x && lastMouseEvent.current.y === y && lastMouseEvent.current.type === type)
            return;
        lastMouseEvent.current = { x, y, type };
        const halfWidth = Math.floor(termWidth.current / 2);
        const isLeftPane = x < halfWidth;
        const isRightPane = x >= halfWidth;
        // Scroll wheel - navigate entries in the active pane
        if (type === 'scroll-up') {
            if (isLeftPane) {
                setPane('local');
                setLocalSelected((value) => Math.max(0, value - 1));
            }
            else {
                setPane('remote');
                setRemoteSelected((value) => Math.max(0, value - 1));
            }
            return;
        }
        if (type === 'scroll-down') {
            if (isLeftPane) {
                setPane('local');
                setLocalSelected((value) => Math.min(Math.max(0, localFiltered.length - 1), value + 1));
            }
            else {
                setPane('remote');
                setRemoteSelected((value) => Math.min(Math.max(0, remoteFiltered.length - 1), value + 1));
            }
            return;
        }
        // Click to switch pane and select entry
        if (type === 'press' && button === 'left') {
            if (y >= PANE_START_ROW && y < PANE_START_ROW + PANE_HEIGHT) {
                if (isLeftPane) {
                    setPane('local');
                    const clickedIndex = localListStart + (y - PANE_START_ROW);
                    if (clickedIndex >= 0 && clickedIndex < localFiltered.length) {
                        setLocalSelected(clickedIndex);
                    }
                }
                else if (isRightPane) {
                    setPane('remote');
                    const clickedIndex = remoteListStart + (y - PANE_START_ROW);
                    if (clickedIndex >= 0 && clickedIndex < remoteFiltered.length) {
                        setRemoteSelected(clickedIndex);
                    }
                }
            }
            else {
                // Click outside panes just switches focus
                if (isLeftPane)
                    setPane('local');
                else if (isRightPane)
                    setPane('remote');
            }
        }
    }, [mouse.x, mouse.y, mouse.type, mouse.button, pendingTransfer, searching, localFiltered.length, remoteFiltered.length, localListStart, remoteListStart]);
    useEffect(() => {
        return () => {
            mounted.current = false;
            remoteRequest.current++;
        };
    }, []);
    useEffect(() => {
        setLocalQuery('');
        refreshLocal();
    }, [localPath]);
    useEffect(() => {
        const next = new SftpClient();
        next.connect({ server, credentials: decryptServerCredentials(server, vault) })
            .then(() => {
            if (!mounted.current)
                return;
            setClient(next);
        })
            .catch((error) => {
            if (!mounted.current)
                return;
            setRemoteLoading(false);
            safeSetStatus(toFriendlyMessage(error));
        });
        return () => {
            next.close();
        };
    }, []);
    useEffect(() => {
        setRemoteQuery('');
        void refreshRemote(client, remotePath);
    }, [remotePath, client]);
    useEffect(() => {
        if (!remoteLoading && !activeTransfer)
            return;
        const timer = setInterval(() => setSpinner((value) => value + 1), 120);
        return () => clearInterval(timer);
    }, [remoteLoading, activeTransfer]);
    useInput((input, key) => {
        const entries = pane === 'local' ? localFiltered : remoteFiltered;
        const selected = pane === 'local' ? Math.min(localSelected, Math.max(0, localFiltered.length - 1)) : Math.min(remoteSelected, Math.max(0, remoteFiltered.length - 1));
        const setSelected = pane === 'local' ? setLocalSelected : setRemoteSelected;
        const current = entries[selected];
        if (pendingTransfer) {
            if ((input === 'y' || input === 'Y') && client) {
                const pending = pendingTransfer;
                setPendingTransfer(null);
                setActiveTransfer({ action: pending.action, path: pending.entry.path, bytesTransferred: 0, totalBytes: pending.entry.size, startedAt: Date.now() });
                safeSetStatus(`${pending.action === 'upload' ? 'Uploading' : 'Downloading'} ${pending.entry.name}...`);
                const task = pending.action === 'upload'
                    ? client.uploadRecursive(pending.entry.path, pending.target, true, safeSetTransfer).then(() => {
                        safeSetTransfer({ action: 'upload', path: pending.entry.path, bytesTransferred: pending.entry.size, totalBytes: pending.entry.size, done: true });
                        safeSetStatus('Upload complete');
                        void refreshRemote();
                    })
                    : (pending.entry.isDirectory ? client.downloadRecursive(pending.entry.path, pending.target, true, safeSetTransfer) : client.downloadFile(pending.entry.path, pending.target, true, safeSetTransfer))
                        .then(() => {
                        safeSetTransfer({ action: 'download', path: pending.entry.path, bytesTransferred: pending.entry.size, totalBytes: pending.entry.size, done: true });
                        safeSetStatus('Download complete');
                        refreshLocal();
                    });
                task.catch((error) => safeSetStatus(toFriendlyMessage(error)));
            }
            else if (input === 'n' || input === 'N' || key.escape) {
                setPendingTransfer(null);
                safeSetStatus('Transfer cancelled');
            }
            return;
        }
        if (searching) {
            if (key.return || key.escape)
                setSearching(false);
            else if (key.backspace || key.delete)
                setActiveQuery((value) => value.slice(0, -1));
            else if (input)
                setActiveQuery((value) => value + input);
            setSelected(0);
            return;
        }
        if (key.tab) {
            setPane((value) => {
                const nextPane = value === 'local' ? 'remote' : 'local';
                if (nextPane === 'remote' && !remoteLoading && remoteEntries.length === 0)
                    void refreshRemote();
                return nextPane;
            });
        }
        if (input === '/') {
            setSearching(true);
            setSelected(0);
        }
        if (key.upArrow)
            setSelected((value) => Math.max(0, value - 1));
        if (key.downArrow)
            setSelected((value) => Math.min(Math.max(0, entries.length - 1), value + 1));
        if (key.pageUp)
            setSelected((value) => Math.max(0, value - 10));
        if (key.pageDown)
            setSelected((value) => Math.min(Math.max(0, entries.length - 1), value + 10));
        if (key.return && current?.isDirectory) {
            if (pane === 'local') {
                setLocalPath(current.path);
                setLocalSelected(0);
            }
            else {
                setRemotePath(current.path);
                setRemoteSelected(0);
            }
        }
        if (key.backspace || key.delete || key.leftArrow) {
            if (pane === 'local')
                setLocalPath(dirname(localPath));
            else
                setRemotePath(parentRemotePath(remotePath));
        }
        if (input === 'r' || input === 'R') {
            refreshLocal();
            void refreshRemote();
        }
        if ((input === 'u' || input === 'U') && client && localFiltered[Math.min(localSelected, Math.max(0, localFiltered.length - 1))]) {
            const entry = localFiltered[Math.min(localSelected, Math.max(0, localFiltered.length - 1))];
            const target = remotePath.replace(/\/$/, '') + '/' + entry.name;
            setPendingTransfer({ action: 'upload', entry, target });
            safeSetStatus(`Upload ${entry.isDirectory ? 'folder' : 'file'} "${entry.name}" from local to ${target}? Press Y to confirm, N to cancel.`);
        }
        if ((input === 'd' || input === 'D') && client && remoteFiltered[Math.min(remoteSelected, Math.max(0, remoteFiltered.length - 1))]) {
            const entry = remoteFiltered[Math.min(remoteSelected, Math.max(0, remoteFiltered.length - 1))];
            const target = join(localPath, entry.name);
            setPendingTransfer({ action: 'download', entry, target });
            safeSetStatus(`Download ${entry.isDirectory ? 'folder' : 'file'} "${entry.name}" from remote to ${target}? Press Y to confirm, N to cancel.`);
        }
        if (input === 'q' || input === 'Q' || key.escape) {
            onBack();
            if (exitOnBack)
                exit();
        }
    });
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [_jsxs(Box, { justifyContent: "space-between", children: [_jsxs(Text, { bold: true, color: "cyan", children: ["Files: ", server.name] }), _jsxs(Text, { dimColor: true, children: [pane === 'local' ? 'Local pane' : 'Remote pane', "  (click/scroll to switch)"] })] }), _jsxs(Text, { children: [_jsx(Text, { dimColor: true, children: "Local:" }), "  ", localPath] }), _jsxs(Text, { children: [_jsx(Text, { dimColor: true, children: "Remote:" }), " ", remotePath] }), _jsxs(Box, { marginTop: 1, children: [_jsx(PaneView, { title: "Local files", role: "download target", active: pane === 'local', entries: localFiltered, selected: localSelected, query: localQuery }), _jsx(PaneView, { title: "Remote files", role: "server source", active: pane === 'remote', entries: remoteFiltered, selected: remoteSelected, query: remoteQuery, loading: remoteLoading, spinner: spinner })] }), activeTransfer ? _jsx(TransferView, { transfer: activeTransfer, spinner: spinner }) : null, _jsx(ActionBar, { pane: pane, searching: searching, pending: Boolean(pendingTransfer) }), _jsx(SearchBar, { pane: pane, searching: searching, query: activeQuery }), _jsx(Text, { color: status === 'Ready' ? 'green' : 'yellow', children: status })] }));
}
function PaneView({ title, role, active, entries, selected, query, loading = false, spinner = 0 }) {
    const height = 15;
    const visibleSelected = Math.min(selected, Math.max(0, entries.length - 1));
    const start = Math.min(Math.max(0, visibleSelected - Math.floor(height / 2)), Math.max(0, entries.length - height));
    const visibleEntries = entries.slice(start, start + height);
    const range = entries.length === 0 ? '0/0' : `${start + 1}-${start + visibleEntries.length}/${entries.length}`;
    return _jsxs(Box, { width: "50%", flexDirection: "column", borderStyle: "single", borderColor: active ? 'cyan' : 'gray', paddingX: 1, children: [_jsxs(Text, { bold: true, color: active ? 'cyan' : undefined, children: [title, " ", _jsxs(Text, { dimColor: true, children: [role, "  ", range, query ? `  /${query}` : ''] })] }), loading ? _jsxs(Text, { color: "yellow", children: [spinnerFrame(spinner), " Loading remote..."] }) : null, !loading && entries.length === 0 ? _jsx(Text, { dimColor: true, children: "Empty" }) : null, !loading && visibleEntries.map((entry, index) => {
                const absoluteIndex = start + index;
                return (_jsxs(Text, { color: absoluteIndex === visibleSelected ? 'cyan' : undefined, children: [absoluteIndex === visibleSelected ? '› ' : '  ', entry.name, entry.isDirectory ? '/' : ''] }, entry.path));
            })] });
}
function ActionBar({ pane, searching, pending }) {
    if (pending)
        return _jsx(Text, { dimColor: true, children: "Y confirm  N cancel  Esc cancel" });
    if (searching)
        return _jsx(Text, { dimColor: true, children: "Type to filter  Backspace delete  Enter apply  Esc close search" });
    return pane === 'remote'
        ? _jsx(Text, { dimColor: true, children: "Enter open  D download  / search  Backspace up  Tab/Click switch  Scroll navigate  Q back" })
        : _jsx(Text, { dimColor: true, children: "Enter open  U upload  / search  Backspace up  Tab/Click switch  Scroll navigate  Q back" });
}
function SearchBar({ pane, searching, query }) {
    const label = pane === 'remote' ? 'Search remote' : 'Search local';
    if (searching)
        return _jsxs(Text, { color: "cyan", children: [label, ": ", query, "\u2588 ", _jsx(Text, { dimColor: true, children: "Enter apply  Esc close" })] });
    return _jsxs(Text, { dimColor: true, children: [label, ": ", query ? `/${query}` : 'press /'] });
}
function TransferView({ transfer, spinner }) {
    const total = transfer.totalBytes ?? 0;
    const percent = total > 0 ? Math.min(100, Math.round((transfer.bytesTransferred / total) * 100)) : 0;
    const label = transfer.action === 'upload' ? 'Uploading' : 'Downloading';
    const color = transfer.done ? 'green' : 'yellow';
    return _jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Text, { color: color, children: [transfer.done ? 'Done' : spinnerFrame(spinner), " ", label, ": ", basenameDisplay(transfer.path)] }), _jsxs(Text, { color: color, children: [progressBar(percent), " ", total > 0 ? `${percent}%  ${formatBytes(transfer.bytesTransferred)} / ${formatBytes(total)}` : `${formatBytes(transfer.bytesTransferred)}`] })] });
}
function progressBar(percent) {
    const width = 24;
    const filled = Math.round((percent / 100) * width);
    return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`;
}
function spinnerFrame(index) {
    return ['-', '\\', '|', '/'][index % 4] ?? '-';
}
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let unit = units[0];
    for (let index = 1; value >= 1024 && index < units.length; index++) {
        value /= 1024;
        unit = units[index];
    }
    return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}
function basenameDisplay(path) {
    const normalized = path.replace(/\\/g, '/');
    return normalized.split('/').filter(Boolean).pop() ?? path;
}
function filterEntries(entries, query) {
    const q = query.trim().toLowerCase();
    if (!q)
        return entries;
    return entries.filter((entry) => entry.name.toLowerCase().includes(q));
}
function parentRemotePath(path) {
    const trimmed = path.trim();
    if (!trimmed || trimmed === '.' || trimmed === '/')
        return trimmed.startsWith('/') ? '/' : '.';
    const normalized = trimmed.replace(/\/+$/, '');
    const parent = posix.dirname(normalized);
    return normalized.startsWith('/') && parent === '.' ? '/' : parent;
}
//# sourceMappingURL=FileManager.js.map