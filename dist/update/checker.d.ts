export declare function getCurrentVersion(): string;
export declare function fetchLatestVersion(): Promise<string | null>;
export declare function compareVersions(current: string, latest: string): boolean;
export interface UpdateCheckResult {
    updateAvailable: boolean;
    currentVersion: string;
    latestVersion: string | null;
}
/**
 * Check for updates, respecting the interval (in hours).
 * Returns immediately from cache if checked recently.
 * Non-blocking — errors are swallowed silently.
 */
export declare function checkForUpdate(intervalHours?: number): Promise<UpdateCheckResult>;
