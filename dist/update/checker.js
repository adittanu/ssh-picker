import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultDataDir } from '../config/paths.js';
const UPDATE_CHECK_FILE = 'update-check.json';
const REGISTRY_URL = 'https://registry.npmjs.org/ssh-picker/latest';
function cacheFilePath() {
    return join(defaultDataDir(), UPDATE_CHECK_FILE);
}
function readCache() {
    const path = cacheFilePath();
    if (!existsSync(path))
        return null;
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    }
    catch {
        return null;
    }
}
function writeCache(cache) {
    const dir = defaultDataDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(cacheFilePath(), JSON.stringify(cache), 'utf8');
}
export function getCurrentVersion() {
    // Read from package.json relative to dist output
    try {
        const pkgPath = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '..', '..', 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        return pkg.version;
    }
    catch {
        return '0.0.0';
    }
}
export async function fetchLatestVersion() {
    try {
        const response = await fetch(REGISTRY_URL, { signal: AbortSignal.timeout(5000) });
        if (!response.ok)
            return null;
        const data = (await response.json());
        return data.version ?? null;
    }
    catch {
        return null;
    }
}
export function compareVersions(current, latest) {
    const parse = (v) => v.split('.').map(Number);
    const [cMajor, cMinor, cPatch] = parse(current);
    const [lMajor, lMinor, lPatch] = parse(latest);
    if (lMajor > cMajor)
        return true;
    if (lMajor === cMajor && lMinor > cMinor)
        return true;
    if (lMajor === cMajor && lMinor === cMinor && lPatch > cPatch)
        return true;
    return false;
}
/**
 * Check for updates, respecting the interval (in hours).
 * Returns immediately from cache if checked recently.
 * Non-blocking — errors are swallowed silently.
 */
export async function checkForUpdate(intervalHours = 24) {
    const currentVersion = await getCurrentVersion();
    const cache = readCache();
    const now = Date.now();
    const intervalMs = intervalHours * 60 * 60 * 1000;
    // Return cached result if still fresh
    if (cache && (now - cache.lastCheck) < intervalMs) {
        return {
            updateAvailable: cache.latestVersion ? compareVersions(currentVersion, cache.latestVersion) : false,
            currentVersion,
            latestVersion: cache.latestVersion
        };
    }
    // Fetch fresh version info
    const latestVersion = await fetchLatestVersion();
    writeCache({ lastCheck: now, latestVersion });
    return {
        updateAvailable: latestVersion ? compareVersions(currentVersion, latestVersion) : false,
        currentVersion,
        latestVersion
    };
}
//# sourceMappingURL=checker.js.map