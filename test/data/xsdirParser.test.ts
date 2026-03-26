import { describe, it, expect } from 'vitest';
import { parseXsdir, getAvailableLibraries } from '../../server/src/data/xsdirParser';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('xsdirParser', () => {
  const content = readFileSync(join(__dirname, '../fixtures/mock-xsdir'), 'utf-8');
  const data = parseXsdir(content);

  it('parses entries from directory section', () => {
    expect(data.entries.size).toBeGreaterThan(0);
  });

  it('finds U-235 entries', () => {
    const libs = getAvailableLibraries(data, '92235');
    expect(libs.length).toBe(4); // 80c, 81c, 82c, 10c
  });

  it('finds H-1 entries', () => {
    const libs = getAvailableLibraries(data, '1001');
    expect(libs.length).toBe(5); // 80c, 71c, 00c, 10c, 11c
  });

  it('parses temperature correctly', () => {
    const libs = getAvailableLibraries(data, '92235');
    const entry80c = libs.find(e => e.suffix === '80c');
    expect(entry80c).toBeDefined();
    // 2.5301E-08 MeV ≈ 293.6 K
    expect(entry80c!.temperature).toBeCloseTo(293.6, 0);
  });

  it('parses higher temperature', () => {
    const libs = getAvailableLibraries(data, '92235');
    const entry81c = libs.find(e => e.suffix === '81c');
    // 5.1704E-08 MeV ≈ 600 K
    expect(entry81c!.temperature).toBeCloseTo(600, 0);
  });

  it('handles photoatomic entries', () => {
    const libs = getAvailableLibraries(data, '26000');
    expect(libs.length).toBe(1);
    expect(libs[0].suffix).toBe('04p');
  });

  it('returns empty for unknown ZAID', () => {
    expect(getAvailableLibraries(data, '99999')).toHaveLength(0);
  });

  it('defaults temperature when value is zero', () => {
    const libs = getAvailableLibraries(data, '26000');
    expect(libs[0].temperature).toBeCloseTo(293.6, 0);
  });

  it('does not alias o-d2o to hwtr', () => {
    // o-d2o (oxygen in heavy water) should not resolve via hwtr (deuterium in heavy water)
    const odEntries = getAvailableLibraries(data, 'o-d2o');
    const lwtrEntries = getAvailableLibraries(data, 'lwtr');
    // The mock xsdir has lwtr but not hwtr or o-d2o, so o-d2o should return empty
    // and must not accidentally resolve to any other S(a,b) entries
    expect(odEntries).toHaveLength(0);
    expect(odEntries).not.toEqual(lwtrEntries);
  });
});
