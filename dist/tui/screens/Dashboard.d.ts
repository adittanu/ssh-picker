import type { ServerRecord } from '../../shared/types.js';
export interface DashboardProps {
    servers: ServerRecord[];
    onConnect: (server: ServerRecord) => void;
    onFiles: (server: ServerRecord) => void;
    onQuit?: () => void;
}
export declare function Dashboard({ servers, onConnect, onFiles, onQuit }: DashboardProps): import("react/jsx-runtime").JSX.Element;
