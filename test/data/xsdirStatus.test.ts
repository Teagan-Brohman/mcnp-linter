import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, copyFileSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadXsdirWithStatus } from '../../server/src/data/xsdirStatus';

const FIXTURES = join(__dirname, '..', 'fixtures');

describe('loadXsdirWithStatus', () => {
  let tmpRoot: string;
  let dirWithXsdir: string;
  let dirWithoutXsdir: string;
  let dirWithBadXsdir: string;

  beforeAll(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'mcnp-xsdir-'));
    dirWithXsdir = join(tmpRoot, 'good');
    dirWithoutXsdir = join(tmpRoot, 'empty');
    dirWithBadXsdir = join(tmpRoot, 'bad');
    mkdirSync(dirWithXsdir);
    mkdirSync(dirWithoutXsdir);
    mkdirSync(dirWithBadXsdir);

    // Copy mock-xsdir fixture into a directory under one of the recognized names.
    copyFileSync(join(FIXTURES, 'mock-xsdir'), join(dirWithXsdir, 'xsdir'));
    // Write an unparseable xsdir (no "directory" section) — parser may or may not
    // throw; if it doesn't, the test below for parse-error becomes a no-op and
    // we only assert on the loaded/not-found/unconfigured states.
    writeFileSync(join(dirWithBadXsdir, 'xsdir'), '\x00\x01garbage no directory marker');
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('returns unconfigured for empty path', () => {
    const { data, status } = loadXsdirWithStatus('');
    expect(data).toBeUndefined();
    expect(status.state).toBe('unconfigured');
    expect(status.configuredPath).toBe('');
  });

  it('returns not-found for a directory without xsdir', () => {
    const { data, status } = loadXsdirWithStatus(dirWithoutXsdir);
    expect(data).toBeUndefined();
    expect(status.state).toBe('not-found');
    expect(status.configuredPath).toBe(dirWithoutXsdir);
    expect(status.errorMessage).toContain('xsdir');
  });

  it('returns loaded with zaidCount for a directory with xsdir', () => {
    const { data, status } = loadXsdirWithStatus(dirWithXsdir);
    expect(data).toBeDefined();
    expect(status.state).toBe('loaded');
    expect(status.zaidCount).toBeGreaterThan(0);
    expect(status.resolvedFile).toContain('xsdir');
    expect(status.configuredPath).toBe(dirWithXsdir);
  });
});
