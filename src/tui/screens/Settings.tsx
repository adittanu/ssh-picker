import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { type AppSettings, type SettingKey, SETTING_DEFINITIONS, ACCENT_COLORS } from '../../config/settings.js';

export interface SettingsProps {
  settings: AppSettings;
  onSave: (key: SettingKey, value: string | number | boolean) => void;
  onBack: () => void;
  active?: boolean;
}

export function Settings({ settings, onSave, onBack, active = true }: SettingsProps) {
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
    const currentVal = settings[current.key] as boolean;
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
      if (!Number.isNaN(num) && num > 0) onSave(current.key, num);
    } else {
      onSave(current.key, editValue);
    }
    setEditing(false);
  };

  useInput((input, key) => {
    if (!active) return;

    if (editing) {
      if (key.escape) setEditing(false);
      else if (key.return) commitEdit();
      else if (key.backspace || key.delete) setEditValue((v) => v.slice(0, -1));
      else if (input) setEditValue((v) => v + input);
      return;
    }

    if (key.escape || input === 'q' || input === 'Q') { onBack(); return; }
    if (key.upArrow) setSelected((v) => Math.max(0, v - 1));
    if (key.downArrow) setSelected((v) => Math.min(defs.length - 1, v + 1));

    if (key.return || input === ' ') {
      if (current.type === 'boolean') toggleBoolean();
      else if (current.type === 'select') cycleSelect();
      else startEdit();
    }
  }, { isActive: active });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Box justifyContent="space-between">
        <Text><Text bold color={settings.accentColor}>Settings</Text></Text>
        <Text dimColor>Esc/Q back   Enter toggle/edit</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {defs.map((def, index) => {
          const value = settings[def.key];
          const isSelected = index === selected;
          const displayValue = formatValue(def.type, value, def.options);

          return (
            <Box key={def.key} flexDirection="column">
              <Text color={isSelected ? settings.accentColor : undefined}>
                {isSelected ? '> ' : '  '}
                {def.label}: {isSelected && editing
                  ? <Text color="yellow">{editValue}<Text color="gray">_</Text></Text>
                  : def.key === 'accentColor'
                    ? <Text color={value as string}>{displayValue}</Text>
                    : <Text color={def.type === 'boolean' ? (value ? 'green' : 'red') : 'white'}>{displayValue}</Text>
                }
              </Text>
              {isSelected && (
                <Text dimColor>    {def.description}</Text>
              )}
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {editing
            ? 'Type value  Enter save  Esc cancel'
            : current?.type === 'boolean'
              ? 'Enter/Space toggle  Up/Down navigate'
              : current?.type === 'select'
                ? 'Enter/Space cycle  Up/Down navigate'
                : 'Enter edit  Up/Down navigate'}
        </Text>
      </Box>
    </Box>
  );
}

function formatValue(type: string, value: unknown, options?: string[]): string {
  if (type === 'boolean') return value ? 'ON' : 'OFF';
  if (type === 'select') return String(value);
  if (type === 'string' && !value) return '(system default)';
  return String(value);
}
