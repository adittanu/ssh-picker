import type { ServerRecord, VaultContext } from '../../shared/types.js';
export interface FileManagerProps {
    server: ServerRecord;
    vault: VaultContext;
    onBack: () => void;
    exitOnBack?: boolean;
}
export declare function FileManager({ server, vault, onBack, exitOnBack }: FileManagerProps): import("react/jsx-runtime").JSX.Element;
