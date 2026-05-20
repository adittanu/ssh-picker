export const ACCENT_COLORS = ['cyan', 'green', 'magenta', 'yellow', 'blue', 'red', 'white'];
export const LAYOUT_STYLES = ['list', 'card'];
export const DEFAULT_SETTINGS = {
    autoUpdateCheck: true,
    updateCheckInterval: 24,
    defaultShell: '',
    showConnectionHistory: true,
    confirmBeforeDelete: true,
    accentColor: 'cyan',
    layout: 'list'
};
export const SETTING_DEFINITIONS = [
    { key: 'accentColor', label: 'Accent color', description: 'Primary color for highlights and selections', type: 'select', options: ACCENT_COLORS },
    { key: 'layout', label: 'Layout', description: 'Dashboard style: list (compact) or card (grid like Termius)', type: 'select', options: LAYOUT_STYLES },
    { key: 'autoUpdateCheck', label: 'Auto update check', description: 'Check for new versions on startup', type: 'boolean' },
    { key: 'updateCheckInterval', label: 'Check interval (hours)', description: 'How often to check for updates', type: 'number' },
    { key: 'defaultShell', label: 'Default shell', description: 'Shell command for SSH (empty = system default)', type: 'string' },
    { key: 'showConnectionHistory', label: 'Show history', description: 'Display connection history in server details', type: 'boolean' },
    { key: 'confirmBeforeDelete', label: 'Confirm delete', description: 'Ask before deleting a server', type: 'boolean' }
];
//# sourceMappingURL=settings.js.map