import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
export function Dashboard({ servers, onConnect, onFiles, onQuit }) {
    const { exit } = useApp();
    const [selected, setSelected] = useState(0);
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? servers.filter((server) => server.name.toLowerCase().includes(q) || server.host.toLowerCase().includes(q)) : servers;
    }, [servers, query]);
    const current = filtered[Math.min(selected, Math.max(0, filtered.length - 1))];
    useInput((input, key) => {
        if (searching) {
            if (key.return || key.escape)
                setSearching(false);
            else if (key.backspace || key.delete)
                setQuery((value) => value.slice(0, -1));
            else if (input)
                setQuery((value) => value + input);
            setSelected(0);
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
        if (input === '/')
            setSearching(true);
        if (input === 'q' || input === 'Q' || key.escape) {
            onQuit?.();
            exit();
        }
    });
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [_jsxs(Box, { children: [_jsxs(Box, { width: "50%", flexDirection: "column", children: [_jsx(Text, { bold: true, children: "SSHP" }), filtered.length === 0 ? _jsx(Text, { color: "yellow", children: "No servers. Run sshp add." }) : filtered.map((server, index) => (_jsxs(Text, { color: index === selected ? 'cyan' : undefined, children: [index === selected ? '› ' : '  ', server.name, " ", _jsxs(Text, { dimColor: true, children: [server.username, "@", server.host, ":", server.port] })] }, server.id)))] }), _jsxs(Box, { width: "50%", flexDirection: "column", children: [_jsx(Text, { bold: true, children: "Quick Actions" }), _jsx(Text, { children: "Enter  Connect SSH" }), _jsx(Text, { children: "F      File Manager" }), _jsx(Text, { children: "/      Search" }), _jsx(Text, { children: "Q/Esc  Quit" })] })] }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Text, { dimColor: true, children: ["Search: ", searching ? query + '█' : (query || 'press /')] }), _jsx(Text, { dimColor: true, children: "Vault: unlocked" })] })] }));
}
//# sourceMappingURL=Dashboard.js.map