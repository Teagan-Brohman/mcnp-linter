/**
 * Normalize a file path for the current platform.
 * On WSL/Linux, converts Windows drive paths (C:\foo) to /mnt/c/foo.
 */
export function normalizePath(p: string): string {
  if (process.platform === 'linux') {
    const driveMatch = p.match(/^([A-Za-z]):[\\\/](.*)/);
    if (driveMatch) {
      const drive = driveMatch[1].toLowerCase();
      const rest = driveMatch[2].replace(/\\/g, '/');
      return `/mnt/${drive}/${rest}`;
    }
  }
  return p;
}
