import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultDataDir } from '../config/paths.js';

const UPDATE_CHECK_FILE = 'update-check.json';
const REGISTRY_URL = 'https://registry.npmjs.org/ssh-picker/latest';

interface UpdateCheckCache {
  lastCheck: number;
  latestVersion: string | null;
}

function cacheFilePath(): string {
  return join(defaultDataDir(), UPDATE_CHECK_FILE);
}

function readCache(): UpdateCheckCache | null {
  const path = cacheFilePath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as UpdateCheckCache;
  } catch {
    return null;
  }
}

function writeCache(cache: UpdateCheckCache): void {
  const dir = defaultDataDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(cacheFilePath(), JSON.stringify(cache), 'utf8');
}

export function getCurrentVersion(): string {
  // Read from package.json relative to dist output
  try {
    const pkgPath = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(REGISTRY_URL, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const data = (await response.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

export function compareVersions(current: string, latest: string): boolean {
  const parse = (v: string) => v.split('.').map(Number);
  const [cMajor, cMinor, cPatch] = parse(current);
  const [lMajor, lMinor, lPatch] = parse(latest);
  if (lMajor > cMajor) return true;
  if (lMajor === cMajor && lMinor > cMinor) return true;
  if (lMajor === cMajor && lMinor === cMinor && lPatch > cPatch) return true;
  return false;
}

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
export async function checkForUpdate(intervalHours = 24): Promise<UpdateCheckResult> {
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
