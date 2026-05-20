import type { LocalForwardConfig, ServerRecord } from '../../shared/types.js';
import type { AppSettings } from '../../config/settings.js';
export interface ServerFormValues {
    name: string;
    host: string;
    username: string;
    port: number;
    authType: 'password' | 'private_key';
    password: string;
    privateKeyPath: string;
    passphrase: string;
    defaultRemotePath: string;
}
export interface DashboardProps {
    servers: ServerRecord[];
    settings: AppSettings;
    onConnect: (server: ServerRecord) => void;
    onFiles: (server: ServerRecord) => void;
    onForward: (server: ServerRecord, forward: LocalForwardConfig) => void | Promise<void>;
    onTest: (server: ServerRecord) => void | Promise<void>;
    onAdd: (values: ServerFormValues) => void | Promise<void>;
    onEdit: (server: ServerRecord, values: ServerFormValues) => void | Promise<void>;
    onDelete: (server: ServerRecord) => void | Promise<void>;
    onSettings?: () => void;
    onQuit?: () => void;
    active?: boolean;
    status?: string | null;
}
export declare function Dashboard({ servers, settings, onConnect, onFiles, onForward, onTest, onAdd, onEdit, onDelete, onSettings, onQuit, active, status }: DashboardProps): import("react/jsx-runtime").JSX.Element;
