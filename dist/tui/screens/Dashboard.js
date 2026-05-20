import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { useMouse } from 'ink-use-mouse';
const baseFormFields = [
    { key: 'name', label: 'Name' },
    { key: 'host', label: 'Host' },
    { key: 'username', label: 'Username' },
    { key: 'port', label: 'Port' },
    { key: 'defaultRemotePath', label: 'Remote path' }
];
const forwardFields = [
    { key: 'localPort', label: 'Local port' },
    { key: 'remoteHost', label: 'Remote host' },
    { key: 'remotePort', label: 'Remote port' }
];
function activeFormFields(form) {
    const credentialFields = form.authType === 'private_key'
        ? [
            { key: 'privateKeyPath', label: 'Key path', optionalOnEdit: true },
            { key: 'passphrase', label: 'Passphrase', secret: true, optionalOnEdit: true }
        ]
        : [{ key: 'password', label: 'Password', secret: true, optionalOnEdit: true }];
    return [...baseFormFields.slice(0, 4), { key: 'authType', label: 'Auth' }, ...credentialFields, baseFormFields[4]];
}
const spinnerFrames = ['-', '\\', '|', '/'];
function emptyForm() {
    return { name: '', host: '', username: '', port: 22, authType: 'password', password: '', privateKeyPath: '', passphrase: '', defaultRemotePath: '/home/' };
}
function defaultForwardForm() {
    return { localHost: '127.0.0.1', localPort: 8080, remoteHost: '127.0.0.1', remotePort: 80 };
}
function editForm(server) {
    return {
        name: server.name,
        host: server.host,
        username: server.username,
        port: server.port,
        authType: server.authType,
        password: '',
        privateKeyPath: '',
        passphrase: '',
        defaultRemotePath: server.defaultRemotePath || `/home/${server.username}`
    };
}
// Layout constants for mouse hit testing
const LIST_START_ROW = 4; // TopBar(1) + margin(1) + border(1) + header(1)
const LIST_HEIGHT = 14;
export function Dashboard({ servers, settings, onConnect, onFiles, onForward, onTest, onAdd, onEdit, onDelete, onSettings, onQuit, active = true, status }) {
    const { exit } = useApp();
    const [selected, setSelected] = useState(0);
    const [query, setQuery] = useState('');
    const [mode, setMode] = useState('browse');
    const [form, setForm] = useState(emptyForm());
    const [forwardForm, setForwardForm] = useState(defaultForwardForm());
    const [fieldIndex, setFieldIndex] = useState(0);
    const [forwardFieldIndex, setForwardFieldIndex] = useState(0);
    const [busy, setBusy] = useState(null);
    const [formError, setFormError] = useState(null);
    const [forwardError, setForwardError] = useState(null);
    const [spinner, setSpinner] = useState(0);
    const lastMouseEvent = useRef(null);
    const mouse = useMouse();
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? servers.filter((server) => `${server.name} ${server.username} ${server.host}`.toLowerCase().includes(q)) : servers;
    }, [servers, query]);
    const visibleSelected = Math.min(selected, Math.max(0, filtered.length - 1));
    const current = filtered[visibleSelected];
    const editing = mode === 'edit';
    // Calculate list viewport start for mouse mapping
    const listStart = Math.min(Math.max(0, visibleSelected - Math.floor(LIST_HEIGHT / 2)), Math.max(0, filtered.length - LIST_HEIGHT));
    // Mouse interaction handling
    useEffect(() => {
        if (!active || mode !== 'browse' || busy)
            return;
        const { x, y, type, button } = mouse;
        const eventKey = `${x},${y},${type}`;
        if (lastMouseEvent.current && lastMouseEvent.current.x === x && lastMouseEvent.current.y === y && lastMouseEvent.current.type === type)
            return;
        lastMouseEvent.current = { x, y, type };
        // Scroll wheel in server list area
        if (type === 'scroll-up') {
            setSelected((value) => Math.max(0, value - 1));
            return;
        }
        if (type === 'scroll-down') {
            setSelected((value) => Math.min(Math.max(0, filtered.length - 1), value + 1));
            return;
        }
        // Click in server list area (left ~36% of width, rows after header)
        if (type === 'press' && button === 'left') {
            // Server list occupies roughly columns 1-30, rows LIST_START_ROW to LIST_START_ROW+LIST_HEIGHT
            if (x >= 1 && x <= 34 && y >= LIST_START_ROW && y < LIST_START_ROW + LIST_HEIGHT) {
                const clickedIndex = listStart + (y - LIST_START_ROW);
                if (clickedIndex >= 0 && clickedIndex < filtered.length) {
                    setSelected(clickedIndex);
                }
            }
        }
    }, [mouse.x, mouse.y, mouse.type, mouse.button, active, mode, busy, filtered.length, listStart]);
    useEffect(() => {
        if (!busy)
            return;
        const timer = setInterval(() => setSpinner((value) => value + 1), 120);
        return () => clearInterval(timer);
    }, [busy]);
    const openAdd = () => {
        setForm(emptyForm());
        setFieldIndex(0);
        setFormError(null);
        setMode('add');
    };
    const openEdit = (server) => {
        setForm(editForm(server));
        setFieldIndex(0);
        setFormError(null);
        setMode('edit');
    };
    const openForward = () => {
        setForwardForm(defaultForwardForm());
        setForwardFieldIndex(0);
        setForwardError(null);
        setMode('forward');
    };
    const closeMode = () => {
        setMode('browse');
        setBusy(null);
    };
    const setFormField = (value) => {
        const field = formFields[fieldIndex]?.key;
        if (!field)
            return;
        setFormError(null);
        setForm((currentForm) => ({ ...currentForm, [field]: field === 'port' ? Number(value) || 0 : field === 'authType' ? normalizeAuthType(value) : value }));
    };
    const currentValue = () => String(form[formFields[fieldIndex]?.key ?? 'name']);
    const appendInput = (input) => {
        const field = formFields[fieldIndex]?.key;
        if (field === 'port' && !/^\d+$/.test(input))
            return;
        if (field === 'authType') {
            setFormField(input.toLowerCase() === 'k' ? 'private_key' : 'password');
            return;
        }
        setFormField(currentValue() + input);
    };
    const deleteInput = () => {
        setFormField(currentValue().slice(0, -1));
    };
    const setForwardField = (value) => {
        const field = forwardFields[forwardFieldIndex]?.key;
        if (!field)
            return;
        setForwardError(null);
        setForwardForm((currentForm) => ({
            ...currentForm,
            [field]: field === 'remoteHost' ? value : Number(value) || 0
        }));
    };
    const currentForwardValue = () => String(forwardForm[forwardFields[forwardFieldIndex]?.key ?? 'localPort']);
    const appendForwardInput = (input) => {
        const field = forwardFields[forwardFieldIndex]?.key;
        if (field !== 'remoteHost' && !/^\d+$/.test(input))
            return;
        setForwardField(currentForwardValue() + input);
    };
    const deleteForwardInput = () => {
        setForwardField(currentForwardValue().slice(0, -1));
    };
    const submitForm = async () => {
        const validation = validateForm(form, editing);
        if (validation !== true) {
            setFormError(validation);
            return;
        }
        setBusy(mode === 'add' ? 'Saving server' : 'Updating server');
        try {
            if (mode === 'add')
                await onAdd(form);
            else if (mode === 'edit' && current)
                await onEdit(current, form);
            closeMode();
        }
        finally {
            setBusy(null);
        }
    };
    const submitForwardForm = async () => {
        const validation = validateForwardForm(forwardForm);
        if (validation !== true) {
            setForwardError(validation);
            return;
        }
        if (!current)
            return;
        setBusy('Starting forward');
        try {
            await onForward(current, forwardForm);
            closeMode();
        }
        finally {
            setBusy(null);
        }
    };
    const nextField = () => {
        if (fieldIndex < formFields.length - 1)
            setFieldIndex((value) => value + 1);
        else
            void submitForm();
    };
    const nextForwardField = () => {
        if (forwardFieldIndex < forwardFields.length - 1)
            setForwardFieldIndex((value) => value + 1);
        else
            void submitForwardForm();
    };
    const formFields = activeFormFields(form);
    useInput((input, key) => {
        if (busy)
            return;
        if (mode === 'search') {
            if (key.return)
                setMode('browse');
            else if (key.escape) {
                setQuery('');
                setMode('browse');
            }
            else if (key.backspace || key.delete)
                setQuery((value) => value.slice(0, -1));
            else if (input) {
                setQuery((value) => value + input);
                setSelected(0);
            }
            return;
        }
        if (mode === 'add' || mode === 'edit') {
            if (key.escape)
                closeMode();
            else if (key.return || key.tab)
                nextField();
            else if (key.upArrow)
                setFieldIndex((value) => Math.max(0, value - 1));
            else if (key.downArrow)
                setFieldIndex((value) => Math.min(formFields.length - 1, value + 1));
            else if (key.backspace || key.delete)
                deleteInput();
            else if (input)
                appendInput(input);
            return;
        }
        if (mode === 'forward') {
            if (key.escape)
                closeMode();
            else if (key.return || key.tab)
                nextForwardField();
            else if (key.upArrow)
                setForwardFieldIndex((value) => Math.max(0, value - 1));
            else if (key.downArrow)
                setForwardFieldIndex((value) => Math.min(forwardFields.length - 1, value + 1));
            else if (key.backspace || key.delete)
                deleteForwardInput();
            else if (input)
                appendForwardInput(input);
            return;
        }
        if (mode === 'delete') {
            if ((input === 'y' || input === 'Y') && current) {
                setBusy('Deleting server');
                void Promise.resolve(onDelete(current)).finally(() => closeMode());
            }
            else if (input === 'n' || input === 'N' || key.escape) {
                closeMode();
            }
            return;
        }
        if (key.upArrow)
            setSelected((value) => Math.max(0, value - 1));
        if (key.downArrow)
            setSelected((value) => Math.min(Math.max(0, filtered.length - 1), value + 1));
        if (key.return && current)
            onConnect(current);
        if ((input === 'f' || input === 'F') && current)
            onFiles(current);
        if ((input === 'p' || input === 'P') && current)
            openForward();
        if ((input === 't' || input === 'T') && current) {
            setBusy('Testing connection');
            void Promise.resolve(onTest(current)).finally(() => setBusy(null));
        }
        if (input === 'a' || input === 'A')
            openAdd();
        if ((input === 'e' || input === 'E') && current)
            openEdit(current);
        if ((key.delete || key.backspace) && current)
            setMode('delete');
        if (input === '/')
            setMode('search');
        if (input === 's' || input === 'S') {
            onSettings?.();
            return;
        }
        if (input === 'q' || input === 'Q' || key.escape) {
            onQuit?.();
            exit();
        }
    }, { isActive: active });
    const accent = settings.accentColor;
    const termWidth = process.stdout.columns || 80;
    const isWide = termWidth >= 90;
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [_jsx(TopBar, { servers: servers.length, query: query, accent: accent }), settings.layout === 'card' ? (isWide ? (_jsxs(Box, { marginTop: 1, children: [_jsx(ServerCardGrid, { servers: filtered, selected: visibleSelected, accent: accent }), _jsx(Box, { width: "50%", flexDirection: "column", paddingLeft: 2, children: mode === 'add' || mode === 'edit'
                            ? _jsx(ServerForm, { mode: mode, form: form, fieldIndex: fieldIndex, busy: busy, spinner: spinner, error: formError, accent: accent })
                            : mode === 'forward'
                                ? _jsx(ForwardForm, { form: forwardForm, fieldIndex: forwardFieldIndex, busy: busy, spinner: spinner, error: forwardError, accent: accent })
                                : mode === 'delete' && current
                                    ? _jsx(DeleteConfirm, { server: current })
                                    : _jsx(ServerDetails, { server: current, accent: accent }) })] })) : (_jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(ServerCardGrid, { servers: filtered, selected: visibleSelected, accent: accent }), _jsx(Box, { marginTop: 1, children: mode === 'add' || mode === 'edit'
                            ? _jsx(ServerForm, { mode: mode, form: form, fieldIndex: fieldIndex, busy: busy, spinner: spinner, error: formError, accent: accent })
                            : mode === 'forward'
                                ? _jsx(ForwardForm, { form: forwardForm, fieldIndex: forwardFieldIndex, busy: busy, spinner: spinner, error: forwardError, accent: accent })
                                : mode === 'delete' && current
                                    ? _jsx(DeleteConfirm, { server: current })
                                    : _jsx(CompactServerInfo, { server: current, accent: accent }) })] }))) : (_jsxs(Box, { marginTop: 1, children: [_jsx(ServerList, { servers: filtered, selected: visibleSelected, accent: accent }), _jsx(Box, { width: "64%", flexDirection: "column", paddingLeft: 2, children: mode === 'add' || mode === 'edit'
                            ? _jsx(ServerForm, { mode: mode, form: form, fieldIndex: fieldIndex, busy: busy, spinner: spinner, error: formError, accent: accent })
                            : mode === 'forward'
                                ? _jsx(ForwardForm, { form: forwardForm, fieldIndex: forwardFieldIndex, busy: busy, spinner: spinner, error: forwardError, accent: accent })
                                : mode === 'delete' && current
                                    ? _jsx(DeleteConfirm, { server: current })
                                    : _jsx(ServerDetails, { server: current, accent: accent }) })] })), _jsx(Footer, { mode: mode, status: status, busy: busy, spinner: spinner })] }));
}
function TopBar({ servers, query, accent }) {
    return _jsxs(Box, { justifyContent: "space-between", children: [_jsxs(Text, { children: [_jsx(Text, { bold: true, color: accent, children: "SSHP" }), " ", _jsx(Text, { dimColor: true, children: "Vault unlocked" }), " ", _jsxs(Text, { dimColor: true, children: [servers, " server", servers === 1 ? '' : 's'] })] }), _jsxs(Text, { dimColor: true, children: [query ? `Search: /${query}` : '/ search', "   A add server"] })] });
}
function ServerList({ servers, selected, accent }) {
    const height = 14;
    const start = Math.min(Math.max(0, selected - Math.floor(height / 2)), Math.max(0, servers.length - height));
    const visible = servers.slice(start, start + height);
    return _jsxs(Box, { width: "36%", flexDirection: "column", borderStyle: "single", borderColor: "gray", paddingX: 1, children: [_jsxs(Text, { bold: true, color: accent, children: ["Servers ", _jsx(Text, { dimColor: true, children: servers.length ? `${start + 1}-${start + visible.length}/${servers.length}` : '0/0' })] }), servers.length === 0 ? (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "yellow", children: "No servers yet" }), _jsx(Text, { dimColor: true, children: "Press A to add your first host" })] })) : visible.map((server, index) => {
                const absoluteIndex = start + index;
                return _jsxs(Text, { color: absoluteIndex === selected ? accent : undefined, children: [absoluteIndex === selected ? '> ' : '  ', truncate(server.name, 28)] }, server.id);
            })] });
}
function ServerCardGrid({ servers, selected, accent }) {
    const visibleCount = 5;
    const start = Math.min(Math.max(0, selected - Math.floor(visibleCount / 2)), Math.max(0, servers.length - visibleCount));
    const visible = servers.slice(start, start + visibleCount);
    return _jsxs(Box, { flexDirection: "column", flexGrow: 1, borderStyle: "single", borderColor: "gray", paddingX: 1, children: [_jsxs(Text, { bold: true, color: accent, children: ["Servers ", _jsx(Text, { dimColor: true, children: servers.length ? `${start + 1}-${start + visible.length}/${servers.length}` : '0/0' })] }), servers.length === 0 ? (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "yellow", children: "No servers yet" }), _jsx(Text, { dimColor: true, children: "Press A to add your first host" })] })) : visible.map((server) => {
                const absIdx = servers.indexOf(server);
                const isSelected = absIdx === selected;
                return _jsxs(Box, { borderStyle: isSelected ? 'bold' : 'single', borderColor: isSelected ? accent : 'gray', paddingX: 1, flexDirection: "column", children: [_jsx(Text, { bold: true, color: isSelected ? accent : 'white', children: truncate(server.name, 24) }), _jsxs(Text, { dimColor: true, children: [server.username, "@", truncate(server.host, 16), ":", server.port] })] }, server.id);
            })] });
}
function CompactServerInfo({ server, accent }) {
    if (!server)
        return _jsx(Text, { dimColor: true, children: "Press A to add a host." });
    return _jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, color: accent, children: server.name }), _jsxs(Text, { dimColor: true, children: [server.username, "@", server.host, ":", server.port, "  ", server.connectionCount, " conn  Last: ", formatDate(server.lastConnectedAt)] }), _jsxs(Text, { children: [_jsx(Text, { color: "green", children: "Enter" }), " SSH  ", _jsx(Text, { color: "green", children: "F" }), " Files  ", _jsx(Text, { color: "green", children: "P" }), " Forward  ", _jsx(Text, { color: "green", children: "T" }), " Test  ", _jsx(Text, { color: "green", children: "E" }), " Edit  ", _jsx(Text, { color: "green", children: "Del" }), " Delete  ", _jsx(Text, { color: "green", children: "A" }), " Add"] })] });
}
function ServerDetails({ server, accent }) {
    if (!server) {
        return _jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, color: "cyan", children: "Welcome" }), _jsx(Text, { children: "No server selected." }), _jsx(Text, { dimColor: true, children: "Press A to add a host." })] });
    }
    return _jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, color: accent, children: server.name }), _jsxs(Text, { children: [server.username, "@", server.host, ":", server.port] }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(Text, { dimColor: true, children: "Default remote" }), _jsx(Text, { children: server.defaultRemotePath || '~' })] }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(Text, { dimColor: true, children: "Usage" }), _jsxs(Text, { children: [server.connectionCount, " connection", server.connectionCount === 1 ? '' : 's', " ", _jsxs(Text, { dimColor: true, children: ["Last: ", formatDate(server.lastConnectedAt)] })] })] }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(Text, { bold: true, color: accent, children: "Actions" }), _jsxs(Text, { children: [_jsx(Text, { color: "green", children: "Enter" }), " SSH   ", _jsx(Text, { color: "green", children: "F" }), " Files   ", _jsx(Text, { color: "green", children: "P" }), " Forward"] }), _jsxs(Text, { children: [_jsx(Text, { color: "green", children: "T" }), " Test      ", _jsx(Text, { color: "green", children: "E" }), " Edit    ", _jsx(Text, { color: "green", children: "Del" }), " Delete  ", _jsx(Text, { color: "green", children: "A" }), " Add"] })] })] });
}
function ServerForm({ mode, form, fieldIndex, busy, spinner, error, accent }) {
    const formFields = activeFormFields(form);
    return _jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, color: accent, children: mode === 'add' ? 'Add server' : 'Edit server' }), _jsx(Text, { dimColor: true, children: mode === 'edit' ? 'Leave password empty to keep the current password.' : 'Follow the fields, then press Enter to save.' }), _jsx(Box, { marginTop: 1, flexDirection: "column", children: formFields.map((field, index) => {
                    const value = form[field.key];
                    const visible = field.secret ? '*'.repeat(String(value).length) : String(value);
                    return _jsxs(Text, { color: index === fieldIndex ? accent : undefined, children: [index === fieldIndex ? '> ' : '  ', field.label, ": ", visible || (field.optionalOnEdit && mode === 'edit' ? '<keep current>' : '')] }, field.key);
                }) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: busy ? `${spinnerFrames[spinner % spinnerFrames.length]} ${busy}...` : 'Enter next/save  Up/Down field  Esc cancel' }) }), error ? _jsx(Text, { color: "yellow", children: error }) : null] });
}
function ForwardForm({ form, fieldIndex, busy, spinner, error, accent }) {
    return _jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, color: accent, children: "Port forwarding" }), _jsx(Text, { dimColor: true, children: "Forward localhost through the selected SSH server." }), _jsx(Box, { marginTop: 1, flexDirection: "column", children: forwardFields.map((field, index) => {
                    const value = form[field.key];
                    return _jsxs(Text, { color: index === fieldIndex ? accent : undefined, children: [index === fieldIndex ? '> ' : '  ', field.label, ": ", String(value)] }, field.key);
                }) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: busy ? `${spinnerFrames[spinner % spinnerFrames.length]} ${busy}...` : 'Enter next/start  Up/Down field  Esc cancel' }) }), _jsxs(Text, { dimColor: true, children: ["Result: ", form.localHost, ":", form.localPort, ' -> ', form.remoteHost, ":", form.remotePort] }), error ? _jsx(Text, { color: "yellow", children: error }) : null] });
}
function DeleteConfirm({ server }) {
    return _jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, color: "red", children: "Delete server" }), _jsxs(Text, { children: ["Delete \"", server.name, "\"?"] }), _jsx(Text, { dimColor: true, children: "This removes the saved credentials from this vault." }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { children: [_jsx(Text, { color: "red", children: "Y" }), " confirm   ", _jsx(Text, { color: "green", children: "N" }), " cancel"] }) })] });
}
function Footer({ mode, status, busy, spinner }) {
    const help = mode === 'browse'
        ? 'Up/Down/Scroll select  Enter SSH  F files  P forward  / search  S settings  Q quit'
        : mode === 'search'
            ? 'Search servers  Enter apply  Esc clear'
            : mode === 'delete'
                ? 'Y confirm  N/Esc cancel'
                : mode === 'forward'
                    ? 'Enter next/start forward  Up/Down field  Esc cancel'
                    : 'Enter next/save  Up/Down field  Esc cancel';
    return _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(Text, { dimColor: true, children: help }), _jsx(Text, { color: statusColor(status), children: busy ? `${spinnerFrames[spinner % spinnerFrames.length]} ${busy}...` : `Status: ${status || 'Ready'}` })] });
}
function statusColor(status) {
    if (!status)
        return 'gray';
    return status.toLowerCase().includes('failed') ? 'red' : 'green';
}
function validateForm(form, editing) {
    if (!form.name.trim())
        return 'Name is required.';
    if (!form.host.trim())
        return 'Host is required.';
    if (!form.username.trim())
        return 'Username is required.';
    if (form.authType === 'password' && !editing && !form.password.trim())
        return 'Password is required.';
    if (form.authType === 'private_key' && !editing && !form.privateKeyPath.trim())
        return 'Private key path is required.';
    if (!form.defaultRemotePath.trim())
        return 'Remote path is required.';
    if (!Number.isInteger(form.port) || form.port <= 0 || form.port > 65_535)
        return 'Port must be between 1 and 65535.';
    return true;
}
function validateForwardForm(form) {
    if (!Number.isInteger(form.localPort) || form.localPort <= 0 || form.localPort > 65_535)
        return 'Local port must be between 1 and 65535.';
    if (!form.remoteHost.trim())
        return 'Remote host is required.';
    if (!Number.isInteger(form.remotePort) || form.remotePort <= 0 || form.remotePort > 65_535)
        return 'Remote port must be between 1 and 65535.';
    return true;
}
function formatDate(value) {
    if (!value)
        return 'never';
    return new Date(value).toLocaleString();
}
function truncate(value, maxLength) {
    if (value.length <= maxLength)
        return value;
    return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
function normalizeAuthType(value) {
    const normalized = value.trim().toLowerCase().replace(/[- ]/g, '_');
    return normalized === 'key' || normalized === 'private_key' ? 'private_key' : 'password';
}
//# sourceMappingURL=Dashboard.js.map