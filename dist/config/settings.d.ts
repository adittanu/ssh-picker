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
export declare const ACCENT_COLORS: AccentColor[];
export declare const LAYOUT_STYLES: LayoutStyle[];
export declare const DEFAULT_SETTINGS: AppSettings;
export type SettingKey = keyof AppSettings;
export interface SettingDef {
    key: SettingKey;
    label: string;
    description: string;
    type: 'boolean' | 'number' | 'string' | 'select';
    options?: string[];
}
export declare const SETTING_DEFINITIONS: SettingDef[];
