import { describe, it, expect } from 'vitest';
import { getLibraryInfo } from '../../server/src/data/libraryInfo';

describe('getLibraryInfo', () => {
  it('returns info for known neutron suffix 80c', () => {
    const info = getLibraryInfo('80c');
    expect(info).toBeDefined();
    expect(info!.source).toContain('ENDF/B-VII.1');
    expect(info!.particleType).toBe('continuous-energy neutron');
    expect(info!.temperature).toBe('~293.6K');
  });

  it('returns info for photoatomic suffix 04p', () => {
    const info = getLibraryInfo('04p');
    expect(info).toBeDefined();
    expect(info!.particleType).toBe('photoatomic');
  });

  it('returns info for electron suffix 03e', () => {
    const info = getLibraryInfo('03e');
    expect(info).toBeDefined();
    expect(info!.particleType).toBe('electron');
  });

  it('returns info for Lib81 suffix 10c', () => {
    const info = getLibraryInfo('10c');
    expect(info).toBeDefined();
    expect(info!.source).toContain('Lib81');
  });

  it('returns undefined for unknown suffix', () => {
    expect(getLibraryInfo('99x')).toBeUndefined();
    expect(getLibraryInfo('')).toBeUndefined();
  });

  it('has at least one continuous-energy neutron entry', () => {
    const info = getLibraryInfo('80c');
    expect(info).toBeDefined();
    expect(info!.particleType).toBe('continuous-energy neutron');
  });

  it('has at least one discrete-reaction neutron entry', () => {
    const info = getLibraryInfo('50d');
    expect(info).toBeDefined();
    expect(info!.particleType).toBe('discrete-reaction neutron');
  });

  it('has at least one photoatomic entry', () => {
    const info = getLibraryInfo('04p');
    expect(info).toBeDefined();
    expect(info!.particleType).toBe('photoatomic');
  });

  it('has at least one photonuclear entry', () => {
    const info = getLibraryInfo('24u');
    expect(info).toBeDefined();
    expect(info!.particleType).toBe('photonuclear');
  });

  it('has at least one electron entry', () => {
    const info = getLibraryInfo('03e');
    expect(info).toBeDefined();
    expect(info!.particleType).toBe('electron');
  });

  it('has at least one proton entry', () => {
    const info = getLibraryInfo('24h');
    expect(info).toBeDefined();
    expect(info!.particleType).toBe('proton');
  });

  it('returns correct temperature for 81c and 00c', () => {
    const info81 = getLibraryInfo('81c');
    expect(info81).toBeDefined();
    expect(info81!.temperature).toBe('~600K');

    const info00 = getLibraryInfo('00c');
    expect(info00).toBeDefined();
    expect(info00!.temperature).toBe('~293.6K');
  });

  it('has no temperature for older library 66c', () => {
    const info = getLibraryInfo('66c');
    expect(info).toBeDefined();
    expect(info!.temperature).toBeUndefined();
  });

  it('returns multigroup particle type for 01g', () => {
    const info = getLibraryInfo('01g');
    expect(info).toBeDefined();
    expect(info!.particleType).toContain('multigroup');
  });
});
