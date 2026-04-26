/**
 * Single source of truth for per-check descriptions used by:
 *   - package.json enum/enumDescriptions for mcnpLinter.suppressChecks
 *   - "Silence check #N" code-action titles
 *
 * Keep numbering and descriptions in sync with the cross-reference table in CLAUDE.md.
 */
export interface CheckEntry {
  number: number;
  description: string;
}

export const CHECK_CATALOG: CheckEntry[] = [
  { number: 1, description: 'Cell → surface reference exists' },
  { number: 2, description: 'Cell → material reference exists' },
  { number: 3, description: 'Valid Z (1-118)' },
  { number: 4, description: 'Plausible isotope mass number' },
  { number: 5, description: 'FILL/LAT/universe consistency' },
  { number: 6, description: 'MT → M existence' },
  { number: 7, description: 'Library consistency within material' },
  { number: 8, description: 'MT/M temperature consistency' },
  { number: 9, description: 'S(a,b) naming vs neutron generation' },
  { number: 10, description: 'Cell number range (1-99,999,999)' },
  { number: 11, description: 'Material number range (0-99,999,999)' },
  { number: 12, description: 'Mixed atom/weight fractions' },
  { number: 13, description: 'LIKE BUT referenced cell exists' },
  { number: 14, description: 'Cell complement #N cross-reference' },
  { number: 15, description: 'Lattice cell alone in universe' },
  { number: 16, description: 'Surface parameter count' },
  { number: 17, description: 'ZAID+suffix existence in xsdir' },
  { number: 18, description: 'READ card info diagnostic' },
  { number: 19, description: 'Tally bin → cell/surface exists' },
  { number: 20, description: 'F7 neutron-only' },
  { number: 21, description: 'Duplicate tally number' },
  { number: 22, description: 'Tally modifier → tally exists' },
  { number: 23, description: 'CF cell flagging refs exist' },
  { number: 24, description: 'SF/FS surface flagging refs exist' },
  { number: 25, description: 'FM material refs exist' },
  { number: 26, description: 'E bins monotonically increasing' },
  { number: 27, description: 'T bins monotonically increasing' },
  { number: 28, description: 'C bins type 1/2 only + last = 1' },
  { number: 29, description: 'CM type 1/2 only' },
  { number: 30, description: 'EM count matches E count' },
  { number: 31, description: 'TM count matches T count' },
  { number: 32, description: 'DE/DF count match' },
  { number: 33, description: 'Unused surface' },
  { number: 34, description: 'Unused material' },
  { number: 35, description: 'Duplicate cell number' },
  { number: 36, description: 'Duplicate surface number' },
  { number: 37, description: 'Duplicate material number' },
  { number: 38, description: 'Duplicate MT card number' },
  { number: 39, description: 'Surface references undefined transform' },
  { number: 40, description: 'Duplicate transform number' },
  { number: 41, description: 'Missing NPS/CTME termination card' },
  { number: 42, description: 'SDEF distribution references' },
  { number: 43, description: 'SDEF CEL/SUR cross-references' },
  { number: 44, description: 'Tally particle not in MODE' },
  { number: 45, description: 'SDEF PAR particle not in MODE' },
  { number: 46, description: 'Surface number range (1-99,999,999)' },
  { number: 47, description: 'No source definition (SDEF or KCODE)' },
  { number: 48, description: 'F6/F7 tally in void cell' },
  { number: 49, description: 'Cell missing IMP for particle in MODE' },
  { number: 50, description: 'Line exceeds 80 columns' },
  { number: 51, description: 'Array FILL reversed range' },
  { number: 52, description: 'LIKE BUT circular reference chain' },
  { number: 53, description: 'IMP entry count vs cell count' },
  { number: 54, description: 'SDEF POS= needs 3 values' },
  { number: 55, description: 'SDEF AXS=/VEC= needs 3 values' },
  { number: 56, description: 'SDEF ERG= must be positive' },
  { number: 57, description: 'KSRC point count not multiple of 3' },
  { number: 58, description: 'Unrecognized cell parameter name' },
  { number: 59, description: 'TMP must be positive' },
  { number: 60, description: 'IMP values must be non-negative' },
  { number: 61, description: 'Transform number range (1-99,999)' },
  { number: 62, description: 'Surface transform must use TR 1-999' },
  { number: 63, description: 'Elemental ZAID (A=0) deprecated' },
  { number: 64, description: 'ZAID missing fraction' },
  { number: 65, description: 'Unrecognized data card' },
  { number: 66, description: 'Uncommented line in commented block' },
];

const lookup = new Map(CHECK_CATALOG.map(c => [c.number, c.description]));

export function describeCheck(n: number): string | undefined {
  return lookup.get(n);
}
