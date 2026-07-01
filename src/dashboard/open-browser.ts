import { execSync } from 'child_process';
import { platform } from 'os';

export function openBrowser(url: string): void {
  const osPlatform = platform();

  try {
    if (osPlatform === 'win32') {
      execSync(`start "${url}"`, { stdio: 'ignore' });
    } else if (osPlatform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' });
    } else {
      execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
    }
  } catch {
    // Browser open failures are non-fatal
  }
}
