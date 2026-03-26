import { describe, it, expect, afterEach } from 'vitest';
import { normalizePath } from '../../server/src/utils/serverUtils';

describe('normalizePath', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true });
  });

  it('converts Windows backslash path on linux', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', writable: true });
    expect(normalizePath('C:\\Users\\foo\\data')).toBe('/mnt/c/Users/foo/data');
  });

  it('converts Windows forward-slash path on linux', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', writable: true });
    expect(normalizePath('D:/some/path')).toBe('/mnt/d/some/path');
  });

  it('returns linux path unchanged on linux', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', writable: true });
    expect(normalizePath('/mnt/c/Users/foo')).toBe('/mnt/c/Users/foo');
  });

  it('returns Windows path unchanged on non-linux platform', () => {
    Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
    expect(normalizePath('C:\\Users\\foo')).toBe('C:\\Users\\foo');
  });

  it('returns empty string unchanged', () => {
    expect(normalizePath('')).toBe('');
  });
});
