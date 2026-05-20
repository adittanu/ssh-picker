export interface AppSettings {
  /** Check for updates on startup */
  autoUpdateCheck: boolean;
  /** Interval between update checks (hours) */
  updateCheckInterval: number;
  /** Default shell command for SSH sessions */
  defaultShell: string;
  /** Show connection history in server details */
  showConnectionHistory: boolean;
  /** Require confirmation before deleting a server */
  confirmBeforeDelete: boolean;
  /** Accent color for the TUI */
  accentColor: AccentColor;
  /** Dashboard layout style */
  layout: LayoutStyle;
}

export type AccentColor = 'cyan' | 'green' | 'magenta' | 'yellow' | 'blue' | 'red' | 'white';
export type LayoutStyle = 'list' | 'card';

export const ACCENT_COLORS: AccentColor[] = ['cyan', 'green', 'magenta', 'yellow', 'blue', 'red', 'white'];
export const LAYOUT_STYLES: LayoutStyle[] = ['list', 'card'];

export const DEFAULT_SETTINGS: AppSettings = {
  autoUpdateCheck: true,
  updateCheckInterval: 24,
  defaultShell: '',
  showConnectionHistory: true,
  confirmBeforeDelete: true,
  accentColor: 'cyan',
  layout: 'list'
};

export type SettingKey = keyof AppSettings;

export interface SettingDef {
  key: SettingKey;
  label: string;
  description: string;
  type: 'boolean' | 'number' | 'string' | 'select';
  options?: string[];
}

export const SETTING_DEFINITIONS: SettingDef[] = [
  { key: 'accentColor', label: 'Accent color', description: 'Primary color for highlights and selections', type: 'select', options: ACCENT_COLORS },
  { key: 'layout', label: 'Layout', description: 'Dashboard style: list (compact) or card (grid like Termius)', type: 'select', options: LAYOUT_STYLES },
  { key: 'autoUpdateCheck', label: 'Auto update check', description: 'Check for new versions on startup', type: 'boolean' },
  { key: 'updateCheckInterval', label: 'Check interval (hours)', description: 'How often to check for updates', type: 'number' },
  { key: 'defaultShell', label: 'Default shell', description: 'Shell command for SSH (empty = system default)', type: 'string' },
  { key: 'showConnectionHistory', label: 'Show history', description: 'Display connection history in server details', type: 'boolean' },
  { key: 'confirmBeforeDelete', label: 'Confirm delete', description: 'Ask before deleting a server', type: 'boolean' }
];
