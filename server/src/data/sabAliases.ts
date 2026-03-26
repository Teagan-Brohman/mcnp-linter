/**
 * S(a,b) thermal scattering name mappings across ENDF/B library generations.
 *
 * Three tables serve different purposes:
 * - `SAB_ALIASES`: bidirectional multi-alias map used by xsdir lookups to find
 *   entries regardless of naming convention (ENDF/B-VII legacy, slash-format,
 *   hyphen transitional, or ENDF/B-VIII canonical).
 * - `LEGACY_TO_ENDF8`: one-way map from legacy → ENDF/B-VIII canonical names,
 *   used to suggest modern replacements in diagnostic messages (check 9).
 * - `ENDF8_TO_LEGACY`: one-way map from ENDF/B-VIII → representative legacy names,
 *   used to suggest legacy alternatives when neutron data is pre-VIII (check 9).
 */

/** Legacy S(a,b) identifiers (ENDF/B-VII era) mapped to their ENDF/B-VIII equivalent.
 *  Note: grph, orthoh/parah/orthod/parad are omitted because ENDF81SaB (VIII.1) reuses
 *  those names — suggesting a different name would be a false positive for VIII.1 users. */
export const LEGACY_TO_ENDF8: Record<string, string> = {
  // Common legacy names
  lwtr: 'h-h2o', hwtr: 'd-d2o', poly: 'h-poly',
  benz: 'h-benz', zrh: 'h-zrh', be: 'be-met', al27: 'al-met',
  fe56: 'fe-met', uuo2: 'u-uo2', ouo2: 'o-uo2', sio2: 'si-sio2',
  lmeth: 'h-lch4', smeth: 'h-sch4',
  // Slash-format variants (ENDF70SAB style)
  'h/zr': 'h-zrh', 'zr/h': 'zr-zrh', 'be/o': 'be-beo',
  'o/be': 'o-beo', 'u/o2': 'u-uo2', 'o2/u': 'o-uo2',
  // Hyphen-format transitional names
  'zr-h': 'zr-zrh', 'be-o': 'be-beo', beo: 'be-beo', 'o-be': 'o-beo',
  'u-o2': 'u-uo2', 'o2-u': 'o-uo2',
  // Ortho/para legacy forms (hortho/hpara/dortho/dpara are ENDF70SAB-only)
  hortho: 'o-h2', hpara: 'p-h2',
  dortho: 'o-d2', dpara: 'p-d2',
};

/** ENDF/B-VIII S(a,b) identifiers mapped to a representative legacy equivalent.
 *  Note: c-graphite and o-h2/p-h2/o-d2/p-d2 are VIII.0-only names not reused in VIII.1,
 *  so we still map them here for the "you're using legacy neutron data" direction. */
export const ENDF8_TO_LEGACY: Record<string, string> = {
  'h-h2o': 'lwtr', 'd-d2o': 'hwtr', 'c-graphite': 'grph',
  'h-poly': 'poly', 'h-benz': 'benz', 'h-zrh': 'zrh', 'zr-zrh': 'zr/h',
  'be-met': 'be', 'be-beo': 'be/o', 'o-beo': 'o/be',
  'al-met': 'al27', 'fe-met': 'fe56',
  'u-uo2': 'u/o2', 'o-uo2': 'o2/u', 'si-sio2': 'sio2',
  'h-lch4': 'lmeth', 'h-sch4': 'smeth',
  'o-h2': 'orthoh', 'p-h2': 'parah', 'o-d2': 'orthod', 'p-d2': 'parad',
};

/**
 * S(a,b) identifier aliases between ENDF/B-VIII and legacy naming conventions.
 * Maps in both directions so lookups work regardless of which convention the
 * MT card or xsdir uses.
 */
export const SAB_ALIASES: Record<string, string[]> = {
  'h-h2o': ['lwtr'],       lwtr: ['h-h2o'],
  'd-d2o': ['hwtr'],       hwtr: ['d-d2o'],
  'c-graphite': ['grph'],  grph: ['c-graphite'],
  'h-poly': ['poly'],      poly: ['h-poly'],
  'h-benz': ['benz'],      benz: ['h-benz'],
  'h-zrh': ['zrh', 'h/zr', 'h-zr'], zrh: ['h-zrh'], 'h/zr': ['h-zrh'], 'h-zr': ['h-zrh'],
  'zr-zrh': ['zr/h', 'zr-h'],       'zr/h': ['zr-zrh'], 'zr-h': ['zr-zrh'],
  'be-met': ['be'],        be: ['be-met'],
  'be-beo': ['be/o', 'be-o', 'beo'], 'be/o': ['be-beo'], 'be-o': ['be-beo'], beo: ['be-beo'],
  'o-beo': ['o/be', 'o-be'],         'o/be': ['o-beo'], 'o-be': ['o-beo'],
  'al-met': ['al27', 'al-27'], al27: ['al-met', 'al-27'], 'al-27': ['al27', 'al-met'],
  'fe-met': ['fe56', 'fe-56'], fe56: ['fe-met', 'fe-56'], 'fe-56': ['fe56', 'fe-met'],
  'u-uo2': ['u/o2', 'u-o2', 'uuo2'], 'u/o2': ['u-uo2'], 'u-o2': ['u-uo2'], uuo2: ['u-uo2'],
  'o-uo2': ['o2/u', 'o2-u', 'ouo2'], 'o2/u': ['o-uo2'], 'o2-u': ['o-uo2'], ouo2: ['o-uo2'],
  'si-sio2': ['sio2'],     sio2: ['si-sio2'],
  'h-lch4': ['lmeth'],     lmeth: ['h-lch4'],
  'h-sch4': ['smeth'],     smeth: ['h-sch4'],
  hortho: ['orthoh', 'o-h2'], orthoh: ['hortho', 'o-h2'], 'o-h2': ['hortho', 'orthoh'],
  hpara: ['parah', 'p-h2'],  parah: ['hpara', 'p-h2'],  'p-h2': ['hpara', 'parah'],
  dortho: ['orthod', 'o-d2'], orthod: ['dortho', 'o-d2'], 'o-d2': ['dortho', 'orthod'],
  dpara: ['parad', 'p-d2'],   parad: ['dpara', 'p-d2'],  'p-d2': ['dpara', 'parad'],
};
