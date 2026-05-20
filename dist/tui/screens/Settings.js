import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { SETTING_DEFINITIONS } from '../../config/settings.js';
export function Settings({ settings, onSave, onBack, active = true }) {
    const [selected, setSelected] = useState(0);
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const defs = SETTING_DEFINITIONS;
    const current = defs[selected];
    const startEdit = () => {
        const value = settings[current.key];
        setEditValue(String(value));
        setEditing(true);
    };
    const toggleBoolean = () => {
        const currentVal = settings[current.key];
        onSave(current.key, !currentVal);
    };
    const cycleSelect = () => {
        const options = current.options ?? [];
        const currentVal = String(settings[current.key]);
        const idx = options.indexOf(currentVal);
        const next = options[(idx + 1) % options.length];
        onSave(current.key, next);
    };
    const commitEdit = () => {
        if (current.type === 'number') {
            const num = Number(editValue);
            if (!Number.isNaN(num) && num > 0)
                onSave(current.key, num);
        }
        else {
            onSave(current.key, editValue);
        }
        setEditing(false);
    };
    useInput((input, key) => {
        if (!active)
            return;
        if (editing) {
            if (key.escape)
                setEditing(false);
            else if (key.return)
                commitEdit();
            else if (key.backspace || key.delete)
                setEditValue((v) => v.slice(0, -1));
            else if (input)
                setEditValue((v) => v + input);
            return;
        }
        if (key.escape || input === 'q' || input === 'Q') {
            onBack();
            return;
        }
        if (key.upArrow)
            setSelected((v) => Math.max(0, v - 1));
        if (key.downArrow)
            setSelected((v) => Math.min(defs.length - 1, v + 1));
        if (key.return || input === ' ') {
            if (current.type === 'boolean')
                toggleBoolean();
            else if (current.type === 'select')
                cycleSelect();
            else
                startEdit();
        }
    }, { isActive: active });
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [_jsxs(Box, { justifyContent: "space-between", children: [_jsx(Text, { children: _jsx(Text, { bold: true, color: settings.accentColor, children: "Settings" }) }), _jsx(Text, { dimColor: true, children: "Esc/Q back   Enter toggle/edit" })] }), _jsx(Box, { marginTop: 1, flexDirection: "column", children: defs.map((def, index) => {
                    const value = settings[def.key];
                    const isSelected = index === selected;
                    const displayValue = formatValue(def.type, value, def.options);
                    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { color: isSelected ? settings.accentColor : undefined, children: [isSelected ? '> ' : '  ', def.label, ": ", isSelected && editing
                                        ? _jsxs(Text, { color: "yellow", children: [editValue, _jsx(Text, { color: "gray", children: "_" })] })
                                        : def.key === 'accentColor'
                                            ? _jsx(Text, { color: value, children: displayValue })
                                            : _jsx(Text, { color: def.type === 'boolean' ? (value ? 'green' : 'red') : 'white', children: displayValue })] }), isSelected && (_jsxs(Text, { dimColor: true, children: ["    ", def.description] }))] }, def.key));
                }) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: editing
                        ? 'Type value  Enter save  Esc cancel'
                        : current?.type === 'boolean'
                            ? 'Enter/Space toggle  Up/Down navigate'
                            : current?.type === 'select'
                                ? 'Enter/Space cycle  Up/Down navigate'
                                : 'Enter edit  Up/Down navigate' }) })] }));
}
function formatValue(type, value, options) {
    if (type === 'boolean')
        return value ? 'ON' : 'OFF';
    if (type === 'select')
        return String(value);
    if (type === 'string' && !value)
        return '(system default)';
    return String(value);
}
//# sourceMappingURL=Settings.js.map