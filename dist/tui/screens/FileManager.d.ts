import type { ServerRecord, VaultContext } from '../../shared/types.js';
export interface FileManagerProps {
    server: ServerRecord;
    vault: VaultContext;
    onBack: () => void;
}
export declare function FileManager({ server, vault, onBack }: FileManagerProps): import("react/jsx-runtime").JSX.Element;
