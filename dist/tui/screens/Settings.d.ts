import { type AppSettings, type SettingKey } from '../../config/settings.js';
export interface SettingsProps {
    settings: AppSettings;
    onSave: (key: SettingKey, value: string | number | boolean) => void;
    onBack: () => void;
    active?: boolean;
}
export declare function Settings({ settings, onSave, onBack, active }: SettingsProps): import("react/jsx-runtime").JSX.Element;
