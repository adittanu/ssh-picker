import type { ServerRecord } from '../../shared/types.js';
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
    onConnect: (server: ServerRecord) => void;
    onFiles: (server: ServerRecord) => void;
    onTest: (server: ServerRecord) => void | Promise<void>;
    onAdd: (values: ServerFormValues) => void | Promise<void>;
    onEdit: (server: ServerRecord, values: ServerFormValues) => void | Promise<void>;
    onDelete: (server: ServerRecord) => void | Promise<void>;
    onQuit?: () => void;
    active?: boolean;
    status?: string | null;
}
export declare function Dashboard({ servers, onConnect, onFiles, onTest, onAdd, onEdit, onDelete, onQuit, active, status }: DashboardProps): import("react/jsx-runtime").JSX.Element;
