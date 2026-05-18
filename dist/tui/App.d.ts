import type { ServerRecord, VaultContext } from '../shared/types.js';
export interface AppProps {
    vault: VaultContext;
}
export type AppExitResult = {
    action: 'connect';
    server: ServerRecord;
} | undefined;
export declare function App({ vault }: AppProps): import("react/jsx-runtime").JSX.Element;
