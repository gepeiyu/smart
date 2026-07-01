import { createRequire } from 'module';
import https from 'https';

const require = createRequire(import.meta.url);
const { version: CURRENT_VERSION } = require('../../package.json');

const PACKAGE_NAME = '@gepeiyu/smart';
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;

export interface VersionCheckResult {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  checked: boolean;
}

export function compareVersions(a: string, b: string): number {
  const parseParts = (v: string): number[] =>
    v.replace(/^v/, '').split('.').map((part) => {
      const numeric = parseInt(part, 10);
      return Number.isNaN(numeric) ? 0 : numeric;
    });
  const partsA = parseParts(a);
  const partsB = parseParts(b);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA !== numB) return numA - numB;
  }
  return 0;
}

export function getCurrentVersion(): string {
  return CURRENT_VERSION;
}

export function getLatestVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const request = https.get(REGISTRY_URL, { timeout: 5000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); resolve(null); return; }
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        try { const parsed = JSON.parse(data) as { version?: string }; resolve(typeof parsed.version === 'string' ? parsed.version : null); }
        catch { resolve(null); }
      });
    });
    request.on('error', () => resolve(null));
    request.on('timeout', () => { request.destroy(); resolve(null); });
  });
}

export async function checkForUpdate(): Promise<VersionCheckResult> {
  const currentVersion = getCurrentVersion();
  const latestVersion = await getLatestVersion();
  if (latestVersion === null) {
    return { currentVersion, latestVersion: null, hasUpdate: false, checked: false };
  }
  return { currentVersion, latestVersion, hasUpdate: compareVersions(latestVersion, currentVersion) > 0, checked: true };
}

export async function printVersionInfo(log: (message: string) => void): Promise<VersionCheckResult> {
  const result = await checkForUpdate();
  log(`  Smart v${result.currentVersion}`);
  if (!result.checked) return result;
  if (result.hasUpdate) {
    log(`  New version v${result.latestVersion} available. Run 'npm update -g ${PACKAGE_NAME}' to upgrade.`);
  } else {
    log('  You are on the latest version.');
  }
  return result;
}
