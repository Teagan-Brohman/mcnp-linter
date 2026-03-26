/**
 * MCNP cross-section library suffix lookup table.
 * Maps common library suffixes to their description.
 */

export interface LibraryInfo {
  suffix: string;
  source: string;
  particleType: string;
  temperature?: string;
}

const libraries: LibraryInfo[] = [
  // Continuous-energy neutron — ENDF/B-VIII.1 (Lib81)
  { suffix: '10c', source: 'ENDF/B-VIII.1 (Lib81)', particleType: 'continuous-energy neutron', temperature: '~293.6K' },
  { suffix: '11c', source: 'ENDF/B-VIII.1 (Lib81)', particleType: 'continuous-energy neutron', temperature: '~600K' },
  { suffix: '12c', source: 'ENDF/B-VIII.1 (Lib81)', particleType: 'continuous-energy neutron', temperature: '~900K' },
  { suffix: '13c', source: 'ENDF/B-VIII.1 (Lib81)', particleType: 'continuous-energy neutron', temperature: '~1200K' },
  { suffix: '14c', source: 'ENDF/B-VIII.1 (Lib81)', particleType: 'continuous-energy neutron', temperature: '~2500K' },
  { suffix: '15c', source: 'ENDF/B-VIII.1 (Lib81)', particleType: 'continuous-energy neutron', temperature: '~0.1K' },
  { suffix: '16c', source: 'ENDF/B-VIII.1 (Lib81)', particleType: 'continuous-energy neutron', temperature: '~233.15K' },
  { suffix: '17c', source: 'ENDF/B-VIII.1 (Lib81)', particleType: 'continuous-energy neutron', temperature: '~273.15K' },
  // Continuous-energy neutron — ENDF/B-VIII.0
  { suffix: '00c', source: 'ENDF/B-VIII.0', particleType: 'continuous-energy neutron', temperature: '~293.6K' },
  // Continuous-energy neutron — ENDF/B-VII.1 (ENDF71x)
  { suffix: '80c', source: 'ENDF/B-VII.1', particleType: 'continuous-energy neutron', temperature: '~293.6K' },
  { suffix: '81c', source: 'ENDF/B-VII.1', particleType: 'continuous-energy neutron', temperature: '~600K' },
  { suffix: '82c', source: 'ENDF/B-VII.1', particleType: 'continuous-energy neutron', temperature: '~900K' },
  { suffix: '83c', source: 'ENDF/B-VII.1', particleType: 'continuous-energy neutron', temperature: '~1200K' },
  { suffix: '84c', source: 'ENDF/B-VII.1', particleType: 'continuous-energy neutron', temperature: '~2500K' },
  { suffix: '85c', source: 'ENDF/B-VII.1', particleType: 'continuous-energy neutron', temperature: '~0.1K' },
  { suffix: '86c', source: 'ENDF/B-VII.1', particleType: 'continuous-energy neutron', temperature: '~250K' },
  // Continuous-energy neutron — ENDF/B-VII.0 (ENDF70)
  { suffix: '70c', source: 'ENDF/B-VII.0', particleType: 'continuous-energy neutron', temperature: '~293.6K' },
  { suffix: '71c', source: 'ENDF/B-VII.0', particleType: 'continuous-energy neutron', temperature: '~600K' },
  { suffix: '72c', source: 'ENDF/B-VII.0', particleType: 'continuous-energy neutron', temperature: '~900K' },
  { suffix: '73c', source: 'ENDF/B-VII.0', particleType: 'continuous-energy neutron', temperature: '~1200K' },
  { suffix: '74c', source: 'ENDF/B-VII.0', particleType: 'continuous-energy neutron', temperature: '~2500K' },
  // Continuous-energy neutron — older
  { suffix: '66c', source: 'ENDF/B-VI.6', particleType: 'continuous-energy neutron' },
  { suffix: '60c', source: 'ENDF/B-VI', particleType: 'continuous-energy neutron' },
  { suffix: '50c', source: 'ENDF/B-V', particleType: 'continuous-energy neutron' },
  { suffix: '24c', source: 'LA150', particleType: 'continuous-energy neutron' },

  // Discrete-reaction neutron
  { suffix: '50d', source: 'ENDF/B-V', particleType: 'discrete-reaction neutron' },

  // Multigroup neutron
  { suffix: '01g', source: 'MGXSNP', particleType: 'multigroup neutron' },
  { suffix: '50m', source: 'MGXSNP', particleType: 'multigroup neutron' },

  // Photonuclear
  { suffix: '24u', source: 'LA150', particleType: 'photonuclear' },

  // Photoatomic
  { suffix: '14p', source: 'EPRData14', particleType: 'photoatomic' },
  { suffix: '12p', source: 'EPRData12', particleType: 'photoatomic' },
  { suffix: '84p', source: 'MCPLIB84', particleType: 'photoatomic' },
  { suffix: '63p', source: 'MCPLIB63', particleType: 'photoatomic' },
  { suffix: '04p', source: 'MCPLIB04', particleType: 'photoatomic' },
  { suffix: '03p', source: 'MCPLIB03', particleType: 'photoatomic' },
  { suffix: '02p', source: 'MCPLIB02', particleType: 'photoatomic' },
  { suffix: '01p', source: 'MCPLIB', particleType: 'photoatomic' },

  // Electron
  { suffix: '04e', source: 'ENDF/B-VIII.0', particleType: 'electron' },
  { suffix: '03e', source: 'ENDF/B-VII.0', particleType: 'electron' },
  { suffix: '01e', source: 'EL', particleType: 'electron' },

  // Proton
  { suffix: '24h', source: 'LA150', particleType: 'proton' },
];

const libraryMap = new Map(libraries.map(lib => [lib.suffix, lib]));

/**
 * Look up library info by suffix (e.g., "80c", "03p").
 */
export function getLibraryInfo(suffix: string): LibraryInfo | undefined {
  return libraryMap.get(suffix);
}

/** Map a library suffix character to its particle type name. */
export function suffixCharToParticleType(ch: string): string {
  switch (ch) {
    case 'c': case 'd': return 'neutron';
    case 'p': return 'photon';
    case 'u': return 'photonuclear';
    case 'e': return 'electron';
    case 'h': return 'proton';
    default: return ch;
  }
}
