/**
 * All known MCNP6.3 data card base names (uppercase, no number suffix).
 * Used to distinguish valid-but-unparsed cards from typos.
 */
export const KNOWN_DATA_CARDS = new Set([
  // Mode / problem control
  'MODE', 'NPS', 'CTME', 'RAND', 'DBCN', 'LOST', 'PRINT', 'TALNP',
  'PRDMP', 'PTRAC', 'MPLOT', 'HISTP', 'EVENT', 'STOP', 'IDUM', 'RDUM',
  'ZA', 'ZB', 'ZC', 'ZD', 'FILES', 'DISABLE', 'VOID',

  // Materials
  'M', 'MT', 'MX', 'OTFDB', 'TOTNU', 'NONU', 'AWTAB', 'XS', 'DRXS', 'PIKMT',
  'FMULT',

  // Source definition
  'SDEF', 'SI', 'SP', 'SB', 'DS', 'SC', 'SSW', 'SSR', 'KCODE', 'KSRC',
  'KOPTS', 'KSEN',

  // Tallies (base names; numbered variants like F5 → base F)
  'F', 'FC', 'E', 'T', 'C', 'FQ', 'FM', 'DE', 'DF', 'EM', 'TM', 'CM',
  'CF', 'SF', 'FS', 'SD', 'FU', 'TF', 'DD', 'DXT', 'FT', 'NOTRN', 'PERT',

  // Mesh tallies
  'FMESH', 'SPDTL', 'MSHMF',
  'TMESH', 'ENDMD', 'RMESH', 'CMESH', 'SMESH',

  // Variance reduction
  'IMP', 'VOL', 'PWT', 'EXT', 'FCL', 'WWE', 'WWN', 'WWP', 'WWG', 'WWGE',
  'MESH', 'ESPLT', 'TSPLT', 'PD', 'DXTRAN', 'DXC', 'BBREM', 'SPABI',
  'WWGT',

  // Physics
  'PHYS', 'CUT', 'ELPT', 'FREE', 'MPHYS', 'LCA', 'LCB', 'LCC', 'LCE',
  'LEA', 'LEB', 'LCI', 'LEE', 'LNCH', 'UNC', 'COSYP', 'COSY', 'BFLCL', 'FIELD',

  // Transforms
  'TR',

  // Cell parameter data cards (standalone form)
  'TMP', 'U', 'LAT', 'FILL', 'TRCL',

  // Surface-related
  'AREA', 'DM',

  // Peripheral / embedded
  'READ', 'BURN', 'EMBED', 'EMBEE', 'EMBTB', 'EMBEB', 'EMBEM', 'EMBDB',
  'EMBDF', 'EMBEDS',

  // Activation / heating
  'ACT', 'HSF', 'HSRC',

  // Deterministic
  'DAWWG', 'MGOPT',
]);

/** Card-name prefix characters that should be stripped before lookup. */
const PREFIX_RE = /^[*+]/;

/** Trailing number suffix (e.g., M1 → M, TR5 → TR, F104 → F). */
const TRAILING_NUM_RE = /\d+$/;

/** Particle designator suffix (e.g., PHYS:N → PHYS, IMP:N,P → IMP). */
const PARTICLE_SUFFIX_RE = /:[A-Z,|/]+$/i;

/**
 * Extract the base card mnemonic from a data block line.
 * Returns undefined for blank/unparseable lines.
 *
 * Examples:
 *   "*TR5  ..."   → "TR"
 *   "PHYS:N ..."  → "PHYS"
 *   "M1  ..."     → "M"
 *   "FM104 ..."   → "FM"
 *   "+F6:N ..."   → "F"
 *   "SDEF ..."    → "SDEF"
 */
export function extractCardBaseName(lineText: string): string | undefined {
  const trimmed = lineText.trim();
  if (!trimmed) return undefined;

  // First token (space-delimited)
  const firstToken = trimmed.split(/\s+/)[0];
  if (!firstToken) return undefined;

  let name = firstToken.toUpperCase();

  // Strip * or + prefix
  name = name.replace(PREFIX_RE, '');

  // Strip :particle suffix
  name = name.replace(PARTICLE_SUFFIX_RE, '');

  // Strip trailing digits — but only if what remains is a known base name
  // or at least 1 letter long. This avoids stripping digits from names that
  // are entirely numeric (shouldn't happen in data block, but defensive).
  const withoutDigits = name.replace(TRAILING_NUM_RE, '');
  if (withoutDigits.length > 0) {
    name = withoutDigits;
  }

  return name || undefined;
}
