import { describe, it, expect } from 'vitest';
import { validateCrossReferences } from '../../server/src/analysis/crossReference';
import { parseInputFile } from '../../server/src/parser/inputFile';
import { parseXsdir } from '../../server/src/data/xsdirParser';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('validateCrossReferences', () => {
  it('produces no errors for valid input', () => {
    const doc = parseInputFile(`valid problem
1  1  -2.7  -1  IMP:N=1
2  0         1  IMP:N=0

1  SO  5.0

M1  13027.80c  1.0
SDEF ERG=1.0
NPS 1000
`);
    const diags = validateCrossReferences(doc);
    expect(diags).toHaveLength(0);
  });

  it('flags undefined surface reference', () => {
    const doc = parseInputFile(`bad surface ref
1  0  -1 -2

1  SO  5.0

NPS 1000
`);
    const diags = validateCrossReferences(doc);
    const surfError = diags.find(d => d.message.includes('Surface 2'));
    expect(surfError).toBeDefined();
    expect(surfError!.severity).toBe('error');
  });

  it('flags undefined material reference', () => {
    const doc = parseInputFile(`bad material ref
1  5  -2.7  -1

1  SO  5.0

NPS 1000
`);
    const diags = validateCrossReferences(doc);
    const matError = diags.find(d => d.message.includes('Material 5'));
    expect(matError).toBeDefined();
    expect(matError!.severity).toBe('error');
  });

  it('does not flag void cell (material 0)', () => {
    const doc = parseInputFile(`void test
1  0  -1

1  SO  5.0

NPS 1000
`);
    const diags = validateCrossReferences(doc);
    const matError = diags.find(d => d.message.includes('Material 0'));
    expect(matError).toBeUndefined();
  });

  it('flags invalid ZAID element Z', () => {
    const doc = parseInputFile(`bad zaid
1  1  -1.0  -1

1  SO  5.0

M1  200001.80c  1.0
`);
    const diags = validateCrossReferences(doc);
    const zaidError = diags.find(d => d.message.includes('not a valid element'));
    expect(zaidError).toBeDefined();
    expect(zaidError!.severity).toBe('error');
  });

  it('flags implausible mass number', () => {
    const doc = parseInputFile(`bad mass
1  1  -1.0  -1

1  SO  5.0

M1  92700.80c  1.0
`);
    const diags = validateCrossReferences(doc);
    const massError = diags.find(d => d.message.includes('no known isotope'));
    expect(massError).toBeDefined();
    expect(massError!.severity).toBe('warning');
  });

  it('accepts natural element (A=0)', () => {
    const doc = parseInputFile(`natural
1  1  -1.0  -1

1  SO  5.0

M1  92000.80c  1.0
`);
    const diags = validateCrossReferences(doc);
    const massError = diags.find(d => d.message.includes('no known isotope'));
    expect(massError).toBeUndefined();
  });

  it('does not warn for metastable isotope ZAIDs', () => {
    const doc = parseInputFile(`metastable
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  47510.80c 1.0
`);
    const diags = validateCrossReferences(doc);
    const isoWarn = diags.find(d => d.message.includes('no known isotope'));
    expect(isoWarn).toBeUndefined();
  });

  it('does not false-warn on LIKE BUT cells', () => {
    const doc = parseInputFile(`like but test
1  1  -1.0  -1  IMP:N=1
2  LIKE  1  BUT  IMP:N=2

1  SO  5.0

M1  1001.80c 0.6667 8016.80c 0.3333
`);
    const diags = validateCrossReferences(doc);
    const voidWarn = diags.find(d => d.message.includes('Void cell 2'));
    expect(voidWarn).toBeUndefined();
    const matWarn = diags.find(d => d.message.includes('material') && d.message.includes('cell 2'));
    expect(matWarn).toBeUndefined();
  });

  describe('universe/lattice validation', () => {
    it('flags FILL referencing undefined universe', () => {
      const doc = parseInputFile(`undefined fill
1  0  -1  FILL=99 IMP:N=1
2  0   1  IMP:N=0

1  SO 5

NPS 100
`);
      const diags = validateCrossReferences(doc);
      const fillError = diags.find(d => d.message.includes('Universe 99'));
      expect(fillError).toBeDefined();
      expect(fillError!.severity).toBe('error');
    });

    it('no error when FILL references a defined universe', () => {
      const doc = parseInputFile(`valid fill
1  0  -1  FILL=1 IMP:N=1
2  0  -2  U=1 IMP:N=1
3  0   1  IMP:N=0

1  SO 10
2  SO 5

NPS 100
`);
      const diags = validateCrossReferences(doc);
      const fillError = diags.find(d => d.message.includes('Universe'));
      expect(fillError).toBeUndefined();
    });

    it('flags LAT without FILL', () => {
      const doc = parseInputFile(`lat no fill
1  0  -1  U=1 LAT=1 IMP:N=1
2  0   1  IMP:N=0

1  SO 5

NPS 100
`);
      const diags = validateCrossReferences(doc);
      const latError = diags.find(d => d.message.includes('LAT') && d.message.includes('FILL'));
      expect(latError).toBeDefined();
      expect(latError!.severity).toBe('error');
    });

    it('no error for valid LAT with FILL', () => {
      const doc = parseInputFile(`valid lat
1  0  -1  FILL=1 IMP:N=1
2  0  -2  U=1 FILL=2 LAT=1 IMP:N=1
3  0  -3  U=2 IMP:N=1
4  0   1  IMP:N=0

1  SO 10
2  SO 5
3  SO 2

NPS 100
`);
      const diags = validateCrossReferences(doc);
      const latError = diags.find(d => d.message.includes('LAT'));
      expect(latError).toBeUndefined();
    });

    it('flags invalid LAT values', () => {
      const doc = parseInputFile(`lat invalid
1  1  -1.0  -1  IMP:N=1  LAT=3  FILL=1  U=1

1  SO  5.0

M1  1001.80c 1.0
`);
      const diags = validateCrossReferences(doc);
      const latWarn = diags.find(d => d.message.includes('LAT=3'));
      expect(latWarn).toBeDefined();
      expect(latWarn!.severity).toBe('error');
    });

    it('accepts LAT=1 and LAT=2', () => {
      const doc = parseInputFile(`lat valid
1  1  -1.0  -1  IMP:N=1  LAT=1  FILL=1  U=1
2  1  -1.0  -2  IMP:N=1  LAT=2  FILL=1  U=2

1  SO  5.0
2  SO  10.0

M1  1001.80c 1.0
`);
      const diags = validateCrossReferences(doc);
      const latWarn = diags.find(d => d.message.includes('must be 1'));
      expect(latWarn).toBeUndefined();
    });
  });

  describe('thermal card validation', () => {
    it('flags MT without matching M', () => {
      const doc = parseInputFile(`mt no material
1  0  -1  IMP:N=1

1  SO  5.0

MT5  lwtr.10t
`);
      const diags = validateCrossReferences(doc);
      const mtError = diags.find(d => d.message.includes('MT5'));
      expect(mtError).toBeDefined();
      expect(mtError!.severity).toBe('error');
      expect(mtError!.message).toContain('M5');
    });

    it('does not flag MT with matching M', () => {
      const doc = parseInputFile(`mt with material
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001.80c 0.6667 8016.80c 0.3333
MT1  lwtr.10t
`);
      const diags = validateCrossReferences(doc);
      const mtError = diags.find(d => d.message.includes('MT1') && d.message.includes('not defined'));
      expect(mtError).toBeUndefined();
    });
  });

  describe('library consistency', () => {
    it('warns when material mixes neutron data libraries', () => {
      const doc = parseInputFile(`mixed libs
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001.80c 0.5 8016.70c 0.5
`);
      const diags = validateCrossReferences(doc);
      const libWarn = diags.find(d => d.message.includes('mixes'));
      expect(libWarn).toBeDefined();
      expect(libWarn!.severity).toBe('warning');
      expect(libWarn!.message).toContain('.70c');
      expect(libWarn!.message).toContain('.80c');
    });

    it('does not warn when all same library', () => {
      const doc = parseInputFile(`same libs
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001.80c 0.5 8016.80c 0.5
`);
      const diags = validateCrossReferences(doc);
      const libWarn = diags.find(d => d.message.includes('mixes'));
      expect(libWarn).toBeUndefined();
    });

    it('does not warn for unsuffixed ZAIDs', () => {
      const doc = parseInputFile(`no suffixes
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001 0.5 8016 0.5
`);
      const diags = validateCrossReferences(doc);
      const libWarn = diags.find(d => d.message.includes('mixes'));
      expect(libWarn).toBeUndefined();
    });

    it('groups by particle type', () => {
      const doc = parseInputFile(`multi particle
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001.80c 0.5 8016.80c 0.3 26000.04p 0.2
`);
      const diags = validateCrossReferences(doc);
      const libWarn = diags.find(d => d.message.includes('mixes'));
      expect(libWarn).toBeUndefined();
    });
  });

  describe('MT/M temperature consistency', () => {
    const xsdirContent = readFileSync(join(__dirname, '../fixtures/mock-xsdir'), 'utf-8');
    const xsdirData = parseXsdir(xsdirContent);

    it('warns when S(a,b) temperature differs from neutron data', () => {
      const doc = parseInputFile(`temp mismatch
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001.00c 0.6667 8016.00c 0.3333
MT1  h-h2o.46t
`);
      const diags = validateCrossReferences(doc, { xsdirData });
      const tempWarn = diags.find(d => d.message.includes('MT1') && d.message.includes('K'));
      expect(tempWarn).toBeDefined();
      expect(tempWarn!.severity).toBe('info');
    });

    it('does not warn when temperatures match', () => {
      const doc = parseInputFile(`temp match
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001.00c 0.6667 8016.00c 0.3333
MT1  h-h2o.40t
`);
      const diags = validateCrossReferences(doc, { xsdirData });
      const tempWarn = diags.find(d => d.message.includes('MT1') && d.message.includes('K'));
      expect(tempWarn).toBeUndefined();
    });

    it('uses suffix fallback without xsdir data', () => {
      const doc = parseInputFile(`no xsdir
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001.00c 0.6667 8016.00c 0.3333
MT1  h-h2o.46t
`);
      const diags = validateCrossReferences(doc);
      const tempWarn = diags.find(d => d.message.includes('MT1') && d.message.includes('different temperature'));
      expect(tempWarn).toBeDefined();
      expect(tempWarn!.severity).toBe('info');
    });

    it('no suffix warning when temperature indices match', () => {
      const doc = parseInputFile(`matching suffix
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001.00c 0.6667 8016.00c 0.3333
MT1  h-h2o.40t
`);
      const diags = validateCrossReferences(doc);
      const tempWarn = diags.find(d => d.message.includes('different temperature'));
      expect(tempWarn).toBeUndefined();
    });

    it('suffix fallback works for ENDF/B-VII suffixes', () => {
      const doc = parseInputFile(`endf7 mismatch
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001.80c 0.6667 8016.80c 0.3333
MT1  lwtr.11t
`);
      const diags = validateCrossReferences(doc);
      const tempWarn = diags.find(d => d.message.includes('different temperature'));
      expect(tempWarn).toBeDefined();
    });
  });

  describe('S(a,b) naming convention', () => {
    it('warns when legacy name used with ENDF/B-VIII neutron data', () => {
      const doc = parseInputFile(`legacy with endf8
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001.00c 0.6667 8016.00c 0.3333
MT1  lwtr.10t
`);
      const diags = validateCrossReferences(doc);
      const warn = diags.find(d => d.message.includes("legacy S(a,b) name 'lwtr'"));
      expect(warn).toBeDefined();
      expect(warn!.message).toContain('h-h2o');
      expect(warn!.severity).toBe('warning');
    });

    it('warns when ENDF/B-VIII name used with legacy neutron data', () => {
      const doc = parseInputFile(`endf8 with legacy
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001.80c 0.6667 8016.80c 0.3333
MT1  h-h2o.10t
`);
      const diags = validateCrossReferences(doc);
      const warn = diags.find(d => d.message.includes("ENDF/B-VIII S(a,b) name 'h-h2o'"));
      expect(warn).toBeDefined();
      expect(warn!.message).toContain('lwtr');
      expect(warn!.severity).toBe('warning');
    });

    it('no warning when legacy name matches legacy neutron data', () => {
      const doc = parseInputFile(`legacy match
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001.80c 0.6667 8016.80c 0.3333
MT1  lwtr.10t
`);
      const diags = validateCrossReferences(doc);
      const warn = diags.find(d => d.message.includes('naming') || d.message.includes("S(a,b) name"));
      expect(warn).toBeUndefined();
    });

    it('no warning when ENDF/B-VIII name matches ENDF/B-VIII neutron data', () => {
      const doc = parseInputFile(`endf8 match
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001.00c 0.6667 8016.00c 0.3333
MT1  h-h2o.40t
`);
      const diags = validateCrossReferences(doc);
      const warn = diags.find(d => d.message.includes('naming') || d.message.includes("S(a,b) name"));
      expect(warn).toBeUndefined();
    });

    it('no warning for identifiers with no alias in the other convention', () => {
      const doc = parseInputFile(`no alias
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001.80c 0.6667 8016.80c 0.3333
MT1  h-ice.10t
`);
      const diags = validateCrossReferences(doc);
      const warn = diags.find(d => d.message.includes("S(a,b) name"));
      expect(warn).toBeUndefined();
    });

    it('warns for ortho/para hydrogen with ENDF/B-VIII data — suggests correct name', () => {
      const doc = parseInputFile(`ortho para
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001.00c 0.6667 8016.00c 0.3333
MT1  hpara.10t
`);
      const diags = validateCrossReferences(doc);
      const warn = diags.find(d => d.message.includes("legacy S(a,b) name 'hpara'"));
      expect(warn).toBeDefined();
      expect(warn!.message).toContain('p-h2');
    });

    it('warns for slash-format legacy names with ENDF/B-VIII data', () => {
      const doc = parseInputFile(`slash format
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001.00c 0.6667 8016.00c 0.3333
MT1  h/zr.10t
`);
      const diags = validateCrossReferences(doc);
      const warn = diags.find(d => d.message.includes("legacy S(a,b) name 'h/zr'"));
      expect(warn).toBeDefined();
      expect(warn!.message).toContain('h-zrh');
    });

    it('warns for lmeth with ENDF/B-VIII data — suggests h-lch4', () => {
      const doc = parseInputFile(`methane legacy
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001.00c 0.6667 8016.00c 0.3333
MT1  lmeth.10t
`);
      const diags = validateCrossReferences(doc);
      const warn = diags.find(d => d.message.includes("legacy S(a,b) name 'lmeth'"));
      expect(warn).toBeDefined();
      expect(warn!.message).toContain('h-lch4');
    });

    it('recognizes .10c as ENDF/B-VIII.1 and expects new naming', () => {
      const doc = parseInputFile(`lib81 test
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001.10c 0.6667 8016.10c 0.3333
MT1  lwtr.70t
`);
      const diags = validateCrossReferences(doc);
      const warn = diags.find(d => d.message.includes("legacy S(a,b) name 'lwtr'"));
      expect(warn).toBeDefined();
      expect(warn!.message).toContain('h-h2o');
    });

    it('does not warn about grph with .10c data (grph is valid in ENDF81SaB)', () => {
      const doc = parseInputFile(`grph viii1 test
1  1  -1.8  -1  IMP:N=1

1  SO  5.0

M1  6012.10c 1.0
MT1  grph.70t
`);
      const diags = validateCrossReferences(doc);
      const warn = diags.find(d => d.message.includes("legacy S(a,b) name 'grph'"));
      expect(warn).toBeUndefined();
    });

    it('does not warn about orthoh/parah with .10c data (valid in ENDF81SaB)', () => {
      const doc = parseInputFile(`orthoh viii1 test
1  1  -1.0  -1  IMP:N=1

1  SO  5.0

M1  1001.10c 1.0
MT1  orthoh.70t
`);
      const diags = validateCrossReferences(doc);
      const warn = diags.find(d => d.message.includes("legacy S(a,b) name 'orthoh'"));
      expect(warn).toBeUndefined();
    });

    it('resolves al-27 through xsdir aliases to al-met entries', () => {
      const xsdirContent = readFileSync(join(__dirname, '../fixtures/mock-xsdir'), 'utf-8');
      const xsdirData = parseXsdir(xsdirContent);
      const doc = parseInputFile(`al-27 test
1  1  -2.7  -1  IMP:N=1

1  SO  5.0

M1  13027.10c 1.0
MT1  al-27.70t
`);
      const diags = validateCrossReferences(doc, { xsdirData });
      const notFound = diags.find(d => d.message.includes('not found in xsdir'));
      expect(notFound).toBeUndefined();
    });
  });

  describe('checks 10-13', () => {
    // Check 10: Cell number range
    it('flags cell number above 99999999', () => {
      const doc = parseInputFile(`cell range high
100000000  0  -1  IMP:N=1
2  0   1  IMP:N=0

1  SO  5.0

NPS 100
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.message.includes('Cell 100000000'));
      expect(err).toBeDefined();
      expect(err!.severity).toBe('error');
      expect(err!.message).toContain('99,999,999');
    });

    it('does not flag cell number 99999999', () => {
      const doc = parseInputFile(`cell range ok
99999999  0  -1  IMP:N=1
2  0   1  IMP:N=0

1  SO  5.0

NPS 100
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.message.includes('Cell 99999999') && d.message.includes('99,999,999'));
      expect(err).toBeUndefined();
    });

    // Check 11: Material number range
    it('flags material number above 99999999', () => {
      const doc = parseInputFile(`mat range high
1  100000000  -1.0  -1  IMP:N=1
2  0           1  IMP:N=0

1  SO  5.0

M100000000  1001.80c  1.0
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.message.includes('M100000000'));
      expect(err).toBeDefined();
      expect(err!.severity).toBe('error');
      expect(err!.message).toContain('99,999,999');
    });

    // Check 12: Mixed atom/weight fractions
    it('flags mixed positive and negative fractions in a material', () => {
      const doc = parseInputFile(`mixed fractions
1  1  -1.0  -1  IMP:N=1
2  0   1  IMP:N=0

1  SO  5.0

M1  1001.80c  0.6667  8016.80c  -0.3333
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.message.includes('mixes atom fractions'));
      expect(err).toBeDefined();
      expect(err!.severity).toBe('error');
    });

    it('does not flag material with all-negative fractions', () => {
      const doc = parseInputFile(`all negative fractions
1  1  -1.0  -1  IMP:N=1
2  0   1  IMP:N=0

1  SO  5.0

M1  1001.80c  -0.1119  8016.80c  -0.8881
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.message.includes('mixes atom fractions'));
      expect(err).toBeUndefined();
    });

    // Check 13: LIKE BUT referenced cell existence
    it('flags LIKE BUT referencing an undefined cell', () => {
      const doc = parseInputFile(`like but undefined
1  1  -1.0  -1  IMP:N=1
2  LIKE  99  BUT  IMP:N=2

1  SO  5.0

M1  1001.80c  1.0
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.message.includes('LIKE 99 BUT') && d.message.includes('not defined'));
      expect(err).toBeDefined();
      expect(err!.severity).toBe('error');
    });

    it('does not flag LIKE BUT when referenced cell exists', () => {
      const doc = parseInputFile(`like but valid
1  1  -1.0  -1  IMP:N=1
2  LIKE  1  BUT  IMP:N=2

1  SO  5.0

M1  1001.80c  1.0
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.message.includes('LIKE') && d.message.includes('not defined'));
      expect(err).toBeUndefined();
    });
  });

  describe('array FILL validation', () => {
    it('reports wrong universe count in array FILL', () => {
      const doc = parseInputFile(`array fill wrong count
1  0  -1  FILL=1 IMP:N=1
2  0  -2  U=1 LAT=1 FILL=0:2 0:1 0:0 1 2 3 IMP:N=1
3  1  -1.0  -3  U=2 IMP:N=1
4  0   1  IMP:N=0

1  SO 10
2  RPP -1 1 -1 1 -1 1
3  SO 0.5

M1 1001.80c 1.0
`);
      const errors = validateCrossReferences(doc);
      const fillErr = errors.find(e => e.message.includes('array FILL') && e.message.includes('6'));
      expect(fillErr).toBeDefined();
    });

    it('reports undefined universe in array FILL', () => {
      const doc = parseInputFile(`array fill undef
1  0  -1  FILL=1 IMP:N=1
2  0  -2  U=1 LAT=1 FILL=0:1 2 99 IMP:N=1
3  1  -1.0  -3  U=2 IMP:N=1
4  0   1  IMP:N=0

1  SO 10
2  RPP -1 1 -1 1 -1 1
3  SO 0.5

M1 1001.80c 1.0
`);
      const errors = validateCrossReferences(doc);
      const undefErr = errors.find(e => e.message.includes('99') && e.message.includes('not defined'));
      expect(undefErr).toBeDefined();
    });

    it('no error for valid array FILL', () => {
      const doc = parseInputFile(`array fill valid
1  0  -1  FILL=1 IMP:N=1
2  0  -2  U=1 LAT=1 FILL=0:1 2 3 IMP:N=1
3  1  -1.0  -3  U=2 IMP:N=1
4  1  -1.0  -4  U=3 IMP:N=1
5  0   1  IMP:N=0

1  SO 10
2  RPP -1 1 -1 1 -1 1
3  SO 0.5
4  SO 0.5

M1 1001.80c 1.0
`);
      const errors = validateCrossReferences(doc);
      const fillErr = errors.find(e => e.message.includes('array FILL'));
      expect(fillErr).toBeUndefined();
    });

    it('universe 0 in array FILL is valid (empty element)', () => {
      const doc = parseInputFile(`array fill with zero
1  0  -1  FILL=1 IMP:N=1
2  0  -2  U=1 LAT=1 FILL=0:1 2 0 IMP:N=1
3  1  -1.0  -3  U=2 IMP:N=1
4  0   1  IMP:N=0

1  SO 10
2  RPP -1 1 -1 1 -1 1
3  SO 0.5

M1 1001.80c 1.0
`);
      const errors = validateCrossReferences(doc);
      const undefErr = errors.find(e => e.message.includes('array FILL') && e.message.includes('not defined'));
      expect(undefErr).toBeUndefined();
    });
  });

  describe('check 15 — lattice alone in universe', () => {
    it('flags lattice not alone in universe', () => {
      const doc = parseInputFile(`lattice not alone check
1  1  -1.0  -1  U=1 LAT=1 FILL=2  IMP:N=1
2  1  -1.0  -2  U=1  IMP:N=1
3  0  1  IMP:N=0

1  SO  5.0
2  SO  10.0

M1  1001.80c 1.0
`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('alone'))).toBeDefined();
    });
  });

  describe('check 14 — cell complement #N', () => {
    it('flags complement referencing non-existent cell', () => {
      const doc = parseInputFile(`complement missing
1  0  -1  IMP:N=1
2  0  1 #99  IMP:N=0

1  SO  5.0

NPS 1000
`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('Cell 99') && d.message.includes('complement'))).toBeDefined();
    });

    it('does not flag complement referencing existing cell', () => {
      const doc = parseInputFile(`complement valid
1  0  -1  IMP:N=1
2  0  1 #1  IMP:N=0

1  SO  5.0

NPS 1000
`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('complement'))).toBeUndefined();
    });
  });

  describe('check 17 — ZAID+suffix existence in xsdir', () => {
    const xsdirContent = readFileSync(join(__dirname, '../fixtures/mock-xsdir'), 'utf-8');
    const xsdirData = parseXsdir(xsdirContent);

    it('no warning for ZAID with valid suffix', () => {
      const doc = parseInputFile(`valid suffix
1  0  -1  IMP:N=1
2  0   1  IMP:N=0

1  SO 5

M1 92235.80c 1.0
`);
      const errors = validateCrossReferences(doc, { xsdirData });
      const xsdirErr = errors.find(e => e.message.includes('xsdir'));
      expect(xsdirErr).toBeUndefined();
    });

    it('warns when suffix not available for ZAID', () => {
      const doc = parseInputFile(`bad suffix
1  0  -1  IMP:N=1
2  0   1  IMP:N=0

1  SO 5

M1 92235.71c 1.0
`);
      const errors = validateCrossReferences(doc, { xsdirData });
      const xsdirErr = errors.find(e => e.message.includes('92235') && e.message.includes('xsdir'));
      expect(xsdirErr).toBeDefined();
      expect(xsdirErr!.message).toContain('available');
    });

    it('warns when ZAID base not in xsdir at all', () => {
      const doc = parseInputFile(`missing zaid
1  0  -1  IMP:N=1
2  0   1  IMP:N=0

1  SO 5

M1 94239.80c 1.0
`);
      const errors = validateCrossReferences(doc, { xsdirData });
      const xsdirErr = errors.find(e => e.message.includes('94239') && e.message.includes('not found'));
      expect(xsdirErr).toBeDefined();
    });

    it('warns when NLIB suffix not available', () => {
      const doc = parseInputFile(`nlib mismatch
1  0  -1  IMP:N=1
2  0   1  IMP:N=0

1  SO 5

M1 92235 1.0 NLIB=71c
`);
      const errors = validateCrossReferences(doc, { xsdirData });
      const xsdirErr = errors.find(e => e.message.includes('92235') && e.message.includes('xsdir'));
      expect(xsdirErr).toBeDefined();
    });

    it('skips unsuffixed ZAID without NLIB', () => {
      const doc = parseInputFile(`no nlib
1  0  -1  IMP:N=1
2  0   1  IMP:N=0

1  SO 5

M1 92235 1.0
`);
      const errors = validateCrossReferences(doc, { xsdirData });
      const xsdirErr = errors.find(e => e.message.includes('xsdir'));
      expect(xsdirErr).toBeUndefined();
    });

    it('skips check when no xsdir data', () => {
      const doc = parseInputFile(`no xsdir
1  0  -1  IMP:N=1
2  0   1  IMP:N=0

1  SO 5

M1 92235.99c 1.0
`);
      const errors = validateCrossReferences(doc);
      const xsdirErr = errors.find(e => e.message.includes('xsdir'));
      expect(xsdirErr).toBeUndefined();
    });

    it('validates photoatomic elemental ZAID', () => {
      const doc = parseInputFile(`photoatomic
1  0  -1  IMP:N=1
2  0   1  IMP:N=0

1  SO 5

M1 26000.04p 1.0
`);
      const errors = validateCrossReferences(doc, { xsdirData });
      const xsdirErr = errors.find(e => e.message.includes('26000') && e.message.includes('xsdir'));
      expect(xsdirErr).toBeUndefined();
    });
  });

  describe('check 18 — READ card info', () => {
    it('warns about READ card external file', () => {
      const doc = parseInputFile(`read test
1  0  -1  IMP:N=0

1  SO  5.0

READ FILE=extra_cells.i
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('READ FILE=extra_cells.i'))).toBeDefined();
    });
  });

  describe('tally validation', () => {
    it('flags F4 referencing non-existent cell', () => {
      const doc = parseInputFile(`tally bad cell\n1  0  -1  IMP:N=0\n\n1  SO  5.0\n\nF4:N 99\nNPS 1000\n`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('Cell 99') && d.message.includes('tally'))).toBeDefined();
    });
    it('accepts F4 referencing existing cell', () => {
      const doc = parseInputFile(`tally good\n1  0  -1  IMP:N=0\n\n1  SO  5.0\n\nF4:N 1\nNPS 1000\n`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('Cell') && d.message.includes('tally'))).toBeUndefined();
    });
    it('flags F2 referencing non-existent surface', () => {
      const doc = parseInputFile(`tally bad surf\n1  0  -1  IMP:N=0\n\n1  SO  5.0\n\nF2:N 99\nNPS 1000\n`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('Surface 99') && d.message.includes('tally'))).toBeDefined();
    });
    it('flags F7 with non-neutron particle', () => {
      const doc = parseInputFile(`tally f7\n1  1  -1.0  -1  IMP:N=1\n2  0  1  IMP:N=0\n\n1  SO  5.0\n\nM1  1001.80c 1.0\nF7:P 1\nNPS 1000\n`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('F7') && d.message.includes('neutron'))).toBeDefined();
    });
    it('does NOT flag tallies of the same type+particle but different numbers', () => {
      // Per MCNP §3.2.5.4: f1:n and f11:n are both legitimate neutron tallies of type 1.
      const doc = parseInputFile(`tally not-dup\n1  0  -1  IMP:N=0\n2  0  1  IMP:N=0\n\n1  SO  5.0\n2  SO  10.0\n\nF1:N 1\nF11:N 2\nNPS 1000\n`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.toLowerCase().includes('duplicate tally'))).toBeUndefined();
    });
    it('flags duplicate tally NUMBER with different particles (F1:N + F1:P)', () => {
      // Per MCNP §3.2.5.4: "Having both an f1:n card and an f1:p card in the same inp file is not allowed."
      const doc = parseInputFile(`tally dup-num\n1  0  -1  IMP:N=0,P=0\n\n1  SO  5.0\n\nF1:N 1\nF1:P 1\nNPS 1000\nMODE N P\n`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.toLowerCase().includes('duplicate tally'))).toBeDefined();
    });
    it('flags duplicate tally NUMBER with same particle (F4:N twice)', () => {
      const doc = parseInputFile(`tally dup-same\n1  0  -1  IMP:N=0\n2  0  1  IMP:N=0\n\n1  SO  5.0\n2  SO  10.0\n\nF4:N 1\nF4:N 2\nNPS 1000\n`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.toLowerCase().includes('duplicate tally'))).toBeDefined();
    });
    it('does NOT flag the user-reported case F1051124:N + F1081014:N', () => {
      // GitHub issue #6 — both type-4 (last digit) neutron tallies, different numbers.
      const doc = parseInputFile(`tally issue6\n1  0  -1  IMP:N=0\n2  0  1  IMP:N=0\n\n1  SO  5.0\n2  SO  10.0\n\nF1051124:N 1\nF1081014:N 2\nNPS 1000\n`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.toLowerCase().includes('duplicate tally'))).toBeUndefined();
    });
    it('flags orphan modifier', () => {
      const doc = parseInputFile(`tally orphan\n1  0  -1  IMP:N=0\n\n1  SO  5.0\n\nE4 0.1 1 20\nNPS 1000\n`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('E4') && d.message.includes('no F4'))).toBeDefined();
    });
    it('flags CF referencing non-existent cell', () => {
      const doc = parseInputFile(`tally cf\n1  0  -1  IMP:N=0\n\n1  SO  5.0\n\nF4:N 1\nCF4 99\nNPS 1000\n`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('CF') && d.message.includes('99'))).toBeDefined();
    });
    it('flags FM referencing non-existent material', () => {
      const doc = parseInputFile(`tally fm\n1  1  -1.0  -1  IMP:N=1\n2  0  1  IMP:N=0\n\n1  SO  5.0\n\nM1  1001.80c 1.0\nF4:N 1\nFM4 -1 99 -6\nNPS 1000\n`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('FM') && d.message.includes('99'))).toBeDefined();
    });
  });

  describe('tally bin validation', () => {
    it('flags non-monotonic energy bins', () => {
      const doc = parseInputFile(`e bins\n1  0  -1  IMP:N=0\n\n1  SO  5.0\n\nF4:N 1\nE4 0.1 20 1\nNPS 1000\n`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('E4') && d.message.includes('monoton'))).toBeDefined();
    });
    it('accepts monotonic energy bins', () => {
      const doc = parseInputFile(`e ok\n1  0  -1  IMP:N=0\n\n1  SO  5.0\n\nF4:N 1\nE4 0.1 1 20\nNPS 1000\n`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('E4') && d.message.includes('monoton'))).toBeUndefined();
    });
    it('flags C card on non-surface tally', () => {
      const doc = parseInputFile(`c f4\n1  0  -1  IMP:N=0\n\n1  SO  5.0\n\nF4:N 1\nC4 -0.5 0 0.5 1\nNPS 1000\n`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('C4') && d.message.includes('type 1 or 2'))).toBeDefined();
    });
    it('flags CM on non-surface tally', () => {
      const doc = parseInputFile(`cm f4\n1  0  -1  IMP:N=0\n\n1  SO  5.0\n\nF4:N 1\nCM4 1 1\nNPS 1000\n`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('CM4') && d.message.includes('type 1 or 2'))).toBeDefined();
    });
    it('flags EM count mismatch', () => {
      const doc = parseInputFile(`em\n1  0  -1  IMP:N=0\n\n1  SO  5.0\n\nF4:N 1\nE4 0.1 1 20\nEM4 1.0 1.0\nNPS 1000\n`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('EM4') && d.message.includes('entries'))).toBeDefined();
    });
    it('flags DE/DF count mismatch', () => {
      const doc = parseInputFile(`dedf\n1  0  -1  IMP:N=0\n\n1  SO  5.0\n\nF4:N 1\nDE4 0.01 0.1 0.2 0.5\nDF4 LIN 0.062 0.533\nNPS 1000\n`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('DE4') && d.message.includes('DF4'))).toBeDefined();
    });
    it('flags cosine bins not ending at 1', () => {
      const doc = parseInputFile(`c bad\n1  0  -1  IMP:N=0\n\n1  SO  5.0\n\nF1:N 1\nC1 -0.5 0 0.5\nNPS 1000\n`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('C1') && d.message.includes('must be 1'))).toBeDefined();
    });
  });

  describe('check 16 — surface parameter counts', () => {
    it('flags SO with wrong parameter count', () => {
      const doc = parseInputFile(`bad so params
1  0  -1  IMP:N=0

1  SO  5.0  3.0

NPS 1000
`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('SO') && d.message.includes('parameter'))).toBeDefined();
    });

    it('accepts S with correct 4 parameters', () => {
      const doc = parseInputFile(`good s params
1  0  -1  IMP:N=0

1  S  0.0 0.0 0.0 5.0

NPS 1000
`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('parameter'))).toBeUndefined();
    });

    it('accepts K/Z with 4 or 5 parameters', () => {
      const doc = parseInputFile(`kz variable
1  0  -1  IMP:N=0

1  K/Z  0 0 0 1.0

NPS 1000
`);
      const diags = validateCrossReferences(doc);
      expect(diags.find(d => d.message.includes('parameter'))).toBeUndefined();
    });
  });

  describe('check 33 — unused surface', () => {
    it('warns on unused surface', () => {
      const text = `unused surface\n1 0 -1 imp:n=1\n\n1 SO 5\n2 PX 10\n\nNPS 1\n`;
      const doc = parseInputFile(text);
      const errors = validateCrossReferences(doc);
      const unused = errors.filter(e => e.message.includes('Surface 2') && e.message.includes('unused'));
      expect(unused.length).toBe(1);
      expect(unused[0].severity).toBe('warning');
    });

    it('no warning when all surfaces are used', () => {
      const text = `all used\n1 0 -1 2 imp:n=1\n\n1 SO 5\n2 PX 10\n\nNPS 1\n`;
      const doc = parseInputFile(text);
      const errors = validateCrossReferences(doc);
      const unused = errors.filter(e => e.message.includes('unused') && e.message.includes('Surface'));
      expect(unused.length).toBe(0);
    });
  });

  it('all cross-reference errors have checkNumber', () => {
    const text = `check numbers\n1 99 -1.0 -999 imp:n=1\n\n1 SO 5\n\nM99 1001.80c 1.0\nNPS 1\n`;
    const doc = parseInputFile(text);
    const errors = validateCrossReferences(doc);
    // Every error from cross-reference should have a checkNumber
    for (const e of errors) {
      expect(e.checkNumber, `Error missing checkNumber: "${e.message}"`).toBeDefined();
    }
  });

  describe('check 34 — unused material', () => {
    it('warns on unused material', () => {
      const text = `unused mat\n1 0 -1 imp:n=1\n\n1 SO 5\n\nM1 1001.80c 1.0\nNPS 1\n`;
      const doc = parseInputFile(text);
      const errors = validateCrossReferences(doc);
      const unused = errors.filter(e => e.message.includes('Material 1') && e.message.includes('unused'));
      expect(unused.length).toBe(1);
    });

    it('no warning when material is used by cell', () => {
      const text = `used mat\n1 1 -1.0 -1 imp:n=1\n\n1 SO 5\n\nM1 1001.80c 1.0\n`;
      const doc = parseInputFile(text);
      const errors = validateCrossReferences(doc);
      const unused = errors.filter(e => e.message.includes('Material 1') && e.message.includes('unused'));
      expect(unused.length).toBe(0);
    });

    it('no warning when material is referenced by MT card', () => {
      const text = `mt ref\n1 0 -1 imp:n=1\n\n1 SO 5\n\nM1 1001.80c 1.0\nMT1 lwtr.10t\n`;
      const doc = parseInputFile(text);
      const errors = validateCrossReferences(doc);
      const unused = errors.filter(e => e.message.includes('Material 1') && e.message.includes('unused'));
      expect(unused.length).toBe(0);
    });

    it('no warning when material is used via LIKE BUT MAT= (uppercase)', () => {
      const text = `like but MAT\n1 0 -1 imp:n=1\n2 like 1 but MAT=1\n\n1 SO 5\n\nM1 1001.80c 1.0\n`;
      const doc = parseInputFile(text);
      const errors = validateCrossReferences(doc);
      const unused = errors.filter(e => e.message.includes('Material 1') && e.message.includes('unused'));
      expect(unused.length).toBe(0);
    });

    it('no warning when material is used via LIKE BUT mat= (lowercase)', () => {
      const text = `like but mat\n1 0 -1 imp:n=1\n2 like 1 but mat=1\n\n1 SO 5\n\nM1 1001.80c 1.0\n`;
      const doc = parseInputFile(text);
      const errors = validateCrossReferences(doc);
      const unused = errors.filter(e => e.message.includes('Material 1') && e.message.includes('unused'));
      expect(unused.length).toBe(0);
    });
  });

  describe('check 35: duplicate cell number', () => {
    it('flags second cell with same number', () => {
      const doc = parseInputFile(`dup cell\n1 0 -1 imp:n=1\n1 0 -2 imp:n=0\n\n1 SO 5\n2 SO 10\n\nNPS 1000\n`);
      const errors = validateCrossReferences(doc);
      const dup = errors.filter(e => e.checkNumber === 35);
      expect(dup.length).toBe(1);
      expect(dup[0].message).toContain('Duplicate cell 1');
      expect(dup[0].severity).toBe('error');
    });

    it('no error when cell numbers are unique', () => {
      const doc = parseInputFile(`unique cells\n1 0 -1 imp:n=1\n2 0 -2 imp:n=0\n\n1 SO 5\n2 SO 10\n\nNPS 1000\n`);
      const errors = validateCrossReferences(doc);
      expect(errors.filter(e => e.checkNumber === 35).length).toBe(0);
    });
  });

  describe('check 36: duplicate surface number', () => {
    it('flags second surface with same number', () => {
      const doc = parseInputFile(`dup surf\n1 0 -1 imp:n=1\n\n1 SO 5\n1 SO 10\n\nNPS 1000\n`);
      const errors = validateCrossReferences(doc);
      const dup = errors.filter(e => e.checkNumber === 36);
      expect(dup.length).toBe(1);
      expect(dup[0].message).toContain('Duplicate surface 1');
      expect(dup[0].severity).toBe('error');
    });

    it('no error when surface numbers are unique', () => {
      const doc = parseInputFile(`unique surfs\n1 0 -1 -2 imp:n=1\n\n1 SO 5\n2 SO 10\n\nNPS 1000\n`);
      const errors = validateCrossReferences(doc);
      expect(errors.filter(e => e.checkNumber === 36).length).toBe(0);
    });
  });

  describe('check 37: duplicate material number', () => {
    it('flags second material with same number', () => {
      const doc = parseInputFile(`dup mat\n1 1 -1.0 -1 imp:n=1\n\n1 SO 5\n\nM1 1001.80c 1.0\nM1 8016.80c 1.0\n`);
      const errors = validateCrossReferences(doc);
      const dup = errors.filter(e => e.checkNumber === 37);
      expect(dup.length).toBe(1);
      expect(dup[0].message).toContain('Duplicate material M1');
      expect(dup[0].severity).toBe('error');
    });

    it('no error when material numbers are unique', () => {
      const doc = parseInputFile(`unique mats\n1 1 -1.0 -1 imp:n=1\n2 2 -1.0 -1 imp:n=1\n\n1 SO 5\n\nM1 1001.80c 1.0\nM2 8016.80c 1.0\n`);
      const errors = validateCrossReferences(doc);
      expect(errors.filter(e => e.checkNumber === 37).length).toBe(0);
    });
  });

  describe('check 38: duplicate MT card number', () => {
    it('flags second MT with same number', () => {
      const doc = parseInputFile(`dup mt\n1 1 -1.0 -1 imp:n=1\n\n1 SO 5\n\nM1 1001.80c 1.0\nMT1 lwtr.10t\nMT1 hwtr.10t\n`);
      const errors = validateCrossReferences(doc);
      const dup = errors.filter(e => e.checkNumber === 38);
      expect(dup.length).toBe(1);
      expect(dup[0].message).toContain('Duplicate MT1');
      expect(dup[0].severity).toBe('error');
    });

    it('no error when MT numbers are unique', () => {
      const doc = parseInputFile(`unique mts\n1 1 -1.0 -1 imp:n=1\n2 2 -1.0 -1 imp:n=1\n\n1 SO 5\n\nM1 1001.80c 1.0\nM2 8016.80c 1.0\nMT1 lwtr.10t\nMT2 hwtr.10t\n`);
      const errors = validateCrossReferences(doc);
      expect(errors.filter(e => e.checkNumber === 38).length).toBe(0);
    });
  });

  describe('check 39: surface references undefined transform', () => {
    it('flags surface referencing undefined TR', () => {
      const doc = parseInputFile(`undef tr\n1 0 -1 imp:n=1\n\n1 5 SO 5.0\n\nNPS 1000\n`);
      const errors = validateCrossReferences(doc);
      const trErr = errors.filter(e => e.checkNumber === 39);
      expect(trErr.length).toBe(1);
      expect(trErr[0].message).toContain('TR5');
      expect(trErr[0].severity).toBe('warning');
    });

    it('no warning when TR is defined', () => {
      const doc = parseInputFile(`valid tr\n1 0 -1 imp:n=1\n\n1 5 SO 5.0\n\nTR5 0 0 10\n`);
      const errors = validateCrossReferences(doc);
      expect(errors.filter(e => e.checkNumber === 39).length).toBe(0);
    });

    it('no warning when surface has no transform', () => {
      const doc = parseInputFile(`no tr\n1 0 -1 imp:n=1\n\n1 SO 5.0\n\nNPS 1000\n`);
      const errors = validateCrossReferences(doc);
      expect(errors.filter(e => e.checkNumber === 39).length).toBe(0);
    });
  });

  describe('check 40: duplicate transform number', () => {
    it('flags second TR with same number', () => {
      const doc = parseInputFile(`dup tr\n1 0 -1 imp:n=1\n\n1 SO 5\n\nTR1 0 0 10\nTR1 1 1 1\n`);
      const errors = validateCrossReferences(doc);
      const dup = errors.filter(e => e.checkNumber === 40);
      expect(dup.length).toBe(1);
      expect(dup[0].message).toContain('Duplicate TR1');
      expect(dup[0].severity).toBe('error');
    });

    it('no error when TR numbers are unique', () => {
      const doc = parseInputFile(`unique trs\n1 0 -1 imp:n=1\n\n1 SO 5\n\nTR1 0 0 10\nTR2 1 1 1\n`);
      const errors = validateCrossReferences(doc);
      expect(errors.filter(e => e.checkNumber === 40).length).toBe(0);
    });

    it('handles *TR prefix correctly', () => {
      const doc = parseInputFile(`star tr\n1 0 -1 imp:n=1\n\n1 SO 5\n\n*TR1 0 0 10\n*TR1 1 1 1\n`);
      const errors = validateCrossReferences(doc);
      const dup = errors.filter(e => e.checkNumber === 40);
      expect(dup.length).toBe(1);
    });
  });

  describe('check 61: transform number range', () => {
    it('flags TR number above 99999', () => {
      const doc = parseInputFile(`tr range high
1 0 -1 IMP:N=1

1 SO 5.0

TR100000 0 0 10
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 61);
      expect(err).toBeDefined();
      expect(err!.severity).toBe('error');
      expect(err!.message).toContain('99,999');
    });

    it('no error for TR number 99999', () => {
      const doc = parseInputFile(`tr range ok
1 0 -1 TRCL=99999 IMP:N=1

1 SO 5.0

TR99999 0 0 10
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 61);
      expect(err).toBeUndefined();
    });
  });

  describe('check 62: surface transform must use TR 1-999', () => {
    it('flags surface referencing TR > 999', () => {
      const doc = parseInputFile(`surf tr high
1 0 -1 IMP:N=1

1 1000 SO 5.0

TR1000 0 0 10
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 62);
      expect(err).toBeDefined();
      expect(err!.severity).toBe('error');
      expect(err!.message).toContain('1–999');
    });

    it('no error for surface referencing TR 999', () => {
      const doc = parseInputFile(`surf tr ok
1 0 -1 IMP:N=1

1 999 SO 5.0

TR999 0 0 10
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 62);
      expect(err).toBeUndefined();
    });
  });

  describe('check 41 — missing NPS/CTME', () => {
    it('check 41: warns when neither NPS nor CTME is present', () => {
      const doc = parseInputFile(`no termination
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
MODE N
`);
      const diags = validateCrossReferences(doc);
      const missing = diags.find(d => d.checkNumber === 41);
      expect(missing).toBeDefined();
      expect(missing!.severity).toBe('warning');
      expect(missing!.message).toMatch(/NPS|CTME|termination/i);
    });

    it('check 41: no warning when NPS is present', () => {
      const doc = parseInputFile(`has NPS
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
NPS 10000
`);
      const diags = validateCrossReferences(doc);
      const missing = diags.find(d => d.checkNumber === 41);
      expect(missing).toBeUndefined();
    });

    it('check 41: no warning when CTME is present', () => {
      const doc = parseInputFile(`has CTME
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
CTME 60
`);
      const diags = validateCrossReferences(doc);
      const missing = diags.find(d => d.checkNumber === 41);
      expect(missing).toBeUndefined();
    });

    it('check 41: no warning when KCODE is present', () => {
      const doc = parseInputFile(`has KCODE
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 92235.80c 1
KCODE 1000 1.0 25 50
KSRC 0 0 0
`);
      const diags = validateCrossReferences(doc);
      const missing = diags.find(d => d.checkNumber === 41);
      expect(missing).toBeUndefined();
    });
  });

  describe('check 42 — SDEF distribution references', () => {
    it('check 42a: flags SDEF Dn referencing non-existent SI card', () => {
      const doc = parseInputFile(`missing SI
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF ERG=D1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 42);
      expect(err).toBeDefined();
      expect(err!.message).toMatch(/SI1/);
    });

    it('check 42a: no error when SI card exists for distribution', () => {
      const doc = parseInputFile(`has SI
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF ERG=D1
SI1 H 0 1 2
SP1 0 0.5 0.5
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 42);
      expect(err).toBeUndefined();
    });

    it('check 42b: warns when SI and SP have different entry counts', () => {
      const doc = parseInputFile(`SI SP mismatch
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF ERG=D1
SI1 H 0 1 2
SP1 0.5 0.5
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 42);
      expect(err).toBeDefined();
      expect(err!.message).toMatch(/count|mismatch|entries/i);
    });

    it('check 42b: skips count check for 3:1 vector distributions (POS=D1)', () => {
      const doc = parseInputFile(`vector dist
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF POS=D1
SI1 L 0 0 0 1 1 1 2 2 2
SP1 0.3 0.3 0.4
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 42);
      expect(err).toBeUndefined();
    });

    it('check 42b: skips count check for built-in SP functions (negative first value)', () => {
      const doc = parseInputFile(`SP built-in
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF ERG=D1
SI1 H 0 1 2
SP1 -21 0.965
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 42);
      expect(err).toBeUndefined();
    });
  });

  describe('check 43 — SDEF CEL/SUR cross-references', () => {
    it('check 43: flags SDEF CEL referencing non-existent cell', () => {
      const doc = parseInputFile(`bad SDEF CEL
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF CEL=99
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 43);
      expect(err).toBeDefined();
      expect(err!.message).toMatch(/Cell 99/);
    });

    it('check 43: flags SDEF SUR referencing non-existent surface', () => {
      const doc = parseInputFile(`bad SDEF SUR
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF SUR=99
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 43);
      expect(err).toBeDefined();
      expect(err!.message).toMatch(/Surface 99/);
    });

    it('check 43: no error when CEL and SUR reference valid entities', () => {
      const doc = parseInputFile(`valid SDEF refs
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF CEL=1 SUR=1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 43);
      expect(err).toBeUndefined();
    });

    it('check 43: skips CEL/SUR check when value is a distribution reference', () => {
      const doc = parseInputFile(`SDEF dist ref
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF CEL=D1
SI1 L 1 2
SP1 0.5 0.5
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 43);
      expect(err).toBeUndefined();
    });
  });

  describe('check 44 — tally particle vs MODE consistency', () => {
    it('check 44: flags tally particle not in MODE', () => {
      const doc = parseInputFile(`tally particle mismatch
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
MODE N
F4:P 1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 44);
      expect(err).toBeDefined();
      expect(err!.severity).toBe('warning');
      expect(err!.message).toMatch(/P/);
    });

    it('check 44: no warning when tally particle is in MODE', () => {
      const doc = parseInputFile(`tally particle match
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
MODE N P
F4:P 1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 44);
      expect(err).toBeUndefined();
    });

    it('check 44: uses default MODE N when no MODE card', () => {
      const doc = parseInputFile(`default mode
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
F4:N 1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 44);
      expect(err).toBeUndefined();
    });

    it('check 44: flags when no MODE and tally uses non-N particle', () => {
      const doc = parseInputFile(`default mode mismatch
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
F4:P 1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 44);
      expect(err).toBeDefined();
    });
  });

  describe('check 45 — SDEF PAR vs MODE consistency', () => {
    it('check 45: flags SDEF PAR particle not in MODE', () => {
      const doc = parseInputFile(`SDEF PAR mismatch
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

MODE N
SDEF PAR=2 ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 45);
      expect(err).toBeDefined();
      expect(err!.severity).toBe('warning');
    });

    it('check 45: no warning when PAR matches MODE (numeric)', () => {
      const doc = parseInputFile(`SDEF PAR match
1 0 -1 IMP:P=1
2 0  1 IMP:P=0

1 SO 5.0

MODE P
SDEF PAR=2 ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 45);
      expect(err).toBeUndefined();
    });

    it('check 45: handles letter-code PAR=N', () => {
      const doc = parseInputFile(`SDEF PAR letter
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

MODE N
SDEF PAR=N ERG=14.1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 45);
      expect(err).toBeUndefined();
    });
  });

  describe('check 46: surface number range', () => {
    it('check 46: flags surface number out of range', () => {
      const doc = parseInputFile(`bad surface number
1 0 -100000000 IMP:N=1
2 0  100000000 IMP:N=0

100000000 SO 5.0

SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 46);
      expect(err).toBeDefined();
      expect(err!.severity).toBe('error');
      expect(err!.message).toContain('99,999,999');
    });

    it('check 46: no error for surface in valid range', () => {
      const doc = parseInputFile(`valid surface
1 0 -99999999 IMP:N=1
2 0  99999999 IMP:N=0

99999999 SO 5.0

SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 46);
      expect(err).toBeUndefined();
    });
  });

  describe('check 47 — no source definition', () => {
    it('check 47: warns when neither SDEF nor KCODE is present', () => {
      const doc = parseInputFile(`no source
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 47);
      expect(err).toBeDefined();
      expect(err!.severity).toBe('warning');
      expect(err!.message).toMatch(/source|SDEF|KCODE/i);
    });

    it('check 47: no warning when SDEF is present', () => {
      const doc = parseInputFile(`has SDEF
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF ERG=14.1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 47);
      expect(err).toBeUndefined();
    });

    it('check 47: no warning when KCODE alone (SRCTP assumed)', () => {
      const doc = parseInputFile(`kcode only
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
KCODE 1000 1.0 10 50
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 47);
      expect(err).toBeUndefined();
    });

    it('check 47: no warning when both KCODE and SDEF present', () => {
      const doc = parseInputFile(`kcode with sdef
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
KCODE 1000 1.0 10 50
SDEF POS=0 0 0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 47);
      expect(err).toBeUndefined();
    });
  });

  describe('check 48 — F6/F7 tally in void cell', () => {
    it('check 48: flags F6 tally referencing void cell', () => {
      const doc = parseInputFile(`F6 void cell
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

F6:N 1
SDEF ERG=14.1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 48);
      expect(err).toBeDefined();
      expect(err!.severity).toBe('warning');
      expect(err!.message).toMatch(/void|material/i);
    });

    it('check 48: flags F7 tally referencing void cell', () => {
      const doc = parseInputFile(`F7 void cell
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

F7:N 1
SDEF ERG=14.1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 48);
      expect(err).toBeDefined();
    });

    it('check 48: no warning for F6 in material cell', () => {
      const doc = parseInputFile(`F6 material cell
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
F6:N 1
SDEF ERG=14.1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 48);
      expect(err).toBeUndefined();
    });

    it('check 48: no warning for F4 in void cell', () => {
      const doc = parseInputFile(`F4 void ok
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

F4:N 1
SDEF ERG=14.1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 48);
      expect(err).toBeUndefined();
    });
  });

  describe('check 49: IMP vs MODE consistency', () => {
    it('check 49: flags cell missing IMP for particle in MODE', () => {
      const doc = parseInputFile(`missing IMP:P
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
MODE N P
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 49 && d.message.includes('Cell 1'));
      expect(err).toBeDefined();
      expect(err!.severity).toBe('warning');
      expect(err!.message).toMatch(/IMP:P|importance.*P/i);
    });

    it('check 49: no warning when all IMP particles match MODE', () => {
      const doc = parseInputFile(`all IMP present
1 1 -2.7 -1 IMP:N=1 IMP:P=1
2 0       1 IMP:N=0 IMP:P=0

1 SO 5.0

M1 13027.80c 1.0
MODE N P
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 49);
      expect(err).toBeUndefined();
    });

    it('check 49: handles combined IMP:N,P=1', () => {
      const doc = parseInputFile(`combined IMP
1 1 -2.7 -1 IMP:N,P=1
2 0       1 IMP:N,P=0

1 SO 5.0

M1 13027.80c 1.0
MODE N P
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 49);
      expect(err).toBeUndefined();
    });

    it('check 49: skips LIKE BUT cells', () => {
      const doc = parseInputFile(`LIKE BUT
1 1 -2.7 -1 IMP:N=1 IMP:P=1
2 LIKE 1 BUT IMP:N=0 IMP:P=0

1 SO 5.0

M1 13027.80c 1.0
MODE N P
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 49);
      expect(err).toBeUndefined();
    });

    it('check 49: uses default MODE N when no MODE card', () => {
      const doc = parseInputFile(`default mode
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
SDEF ERG=14.1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 49);
      expect(err).toBeUndefined();
    });

    it('check 49: skips when no cells have IMP (data-block IMP assumed)', () => {
      const doc = parseInputFile(`data block IMP
1 1 -2.7 -1
2 0       1

1 SO 5.0

M1 13027.80c 1.0
SDEF ERG=14.1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 49);
      expect(err).toBeUndefined();
    });

    it('check 49: skips when minority of cells have IMP (data-block IMP assumed)', () => {
      // 3 cells: only 1 has cell-param IMP, 2 don't → minority, skip check
      const doc = parseInputFile(`minority IMP
1 1 -2.7 -1 IMP:N=1
2 1 -2.7 -2
3 0       1 2

1 SO 5.0
2 SO 10.0

M1 13027.80c 1.0
SDEF ERG=14.1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 49);
      expect(err).toBeUndefined();
    });

    it('check 49: warns when majority of cells have IMP', () => {
      // 3 non-LIKE cells: 2 have IMP, 1 doesn't → majority, check fires
      const doc = parseInputFile(`majority IMP
1 1 -2.7 -1 IMP:N=1
2 1 -2.7 -2 IMP:N=1
3 0       1 2

1 SO 5.0
2 SO 10.0

M1 13027.80c 1.0
SDEF ERG=14.1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 49 && d.message.includes('Cell 3'));
      expect(err).toBeDefined();
    });

    it('check 49: skips particle when data-block IMP covers it', () => {
      const doc = parseInputFile(`data-block IMP covers N
1 1 -2.7 -1
2 0       1

1 SO 5.0

M1 13027.80c 1.0
MODE N P
IMP:N 1 0
IMP:P 1 0
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 49);
      expect(err).toBeUndefined();
    });

    it('check 49: warns for uncovered particle even with data-block IMP for others', () => {
      // Data-block IMP covers N, but not P. Cells have cell-param IMP:P on majority.
      const doc = parseInputFile(`mixed IMP
1 1 -2.7 -1 IMP:P=1
2 1 -2.7 -2 IMP:P=1
3 0       1 2

1 SO 5.0
2 SO 10.0

M1 13027.80c 1.0
MODE N P
IMP:N 1 1 0
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      // N is covered by data-block IMP, P should warn for cell 3 (no IMP:P, majority have it)
      const err = diags.find(d => d.checkNumber === 49 && d.message.includes('Cell 3') && d.message.includes('IMP:P'));
      expect(err).toBeDefined();
    });
  });

  describe('check 53: IMP entry count vs cell count', () => {
    it('check 53: flags IMP entry count vs cell count mismatch', () => {
      const doc = parseInputFile(`IMP count mismatch
1 1 -2.7 -1
2 0       1

1 SO 5.0

M1 13027.80c 1.0
IMP:N 1 0 1
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 53);
      expect(err).toBeDefined();
      expect(err!.message).toMatch(/2 cells|3 values/);
    });

    it('check 53: no warning when IMP count matches cell count', () => {
      const doc = parseInputFile(`IMP count matches
1 1 -2.7 -1
2 0       1

1 SO 5.0

M1 13027.80c 1.0
IMP:N 1 0
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 53);
      expect(err).toBeUndefined();
    });
  });

  describe('check 50: line length warning', () => {
    it('check 50: flags lines exceeding 80 columns when enabled', () => {
      const longLine = 'M1 ' + '13027.80c 1.0 '.repeat(8); // >80 chars
      const doc = parseInputFile(`long line test
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

${longLine}
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc, { warnLineLength: true });
      const err = diags.find(d => d.checkNumber === 50);
      expect(err).toBeDefined();
      expect(err!.severity).toBe('warning');
      expect(err!.message).toMatch(/80/);
    });

    it('check 50: no warning when disabled (default)', () => {
      const longLine = 'M1 ' + '13027.80c 1.0 '.repeat(8);
      const doc = parseInputFile(`long line test
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

${longLine}
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 50);
      expect(err).toBeUndefined();
    });

    it('check 50: no warning for lines <= 80 chars', () => {
      const doc = parseInputFile(`short lines
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc, { warnLineLength: true });
      const err = diags.find(d => d.checkNumber === 50);
      expect(err).toBeUndefined();
    });

    it('check 50: skips comment lines', () => {
      const longComment = 'c ' + 'x'.repeat(100);
      const doc = parseInputFile(`comment test
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

${longComment}
M1 13027.80c 1.0
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc, { warnLineLength: true });
      const err = diags.find(d => d.checkNumber === 50);
      expect(err).toBeUndefined();
    });
  });

  describe('check 51: reversed array FILL range', () => {
    it('check 51: flags reversed array FILL range', () => {
      const doc = parseInputFile(`reversed FILL range
1 1 -2.7 -1 FILL=10:5 1 2 3 4 5 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 51);
      expect(err).toBeDefined();
      expect(err!.severity).toBe('error');
      expect(err!.message).toMatch(/reversed|low:high/i);
    });

    it('check 51: no error for valid FILL range', () => {
      const doc = parseInputFile(`valid FILL range
1 1 -2.7 -1 FILL=0:2 1 2 3 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 51);
      expect(err).toBeUndefined();
    });
  });

  describe('check 52: LIKE BUT cyclic chain + inherited material', () => {
    it('flags circular LIKE BUT chain', () => {
      const doc = parseInputFile(`cyclic LIKE
1 LIKE 2 BUT IMP:N=1
2 LIKE 1 BUT IMP:N=0

1 SO 5.0

SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 52);
      expect(err).toBeDefined();
      expect(err!.severity).toBe('error');
      expect(err!.message).toMatch(/circular|cycle/i);
    });

    it('no error for valid LIKE BUT chain', () => {
      const doc = parseInputFile(`valid LIKE
1 1 -2.7 -1 IMP:N=1
2 LIKE 1 BUT IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 52);
      expect(err).toBeUndefined();
    });

    it('flags inherited undefined material via LIKE chain', () => {
      const doc = parseInputFile(`inherited bad material
1 99 -2.7 -1 IMP:N=1
2 LIKE 1 BUT IMP:N=0

1 SO 5.0

SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      // Check 2 should fire on cell 1 directly AND on cell 2 via inheritance
      const cell2Err = diags.find(d => d.checkNumber === 2 && d.message.includes('Cell 2'));
      expect(cell2Err).toBeDefined();
      expect(cell2Err!.message).toMatch(/inherit|LIKE/i);
    });
  });

  describe('check 54 — SDEF POS value count', () => {
    it('check 54: flags SDEF POS with wrong value count', () => {
      const doc = parseInputFile(`bad POS
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF POS=1.0 2.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 54);
      expect(err).toBeDefined();
      expect(err!.message).toMatch(/2 values.*3/);
    });

    it('check 54: no error for POS with 3 values', () => {
      const doc = parseInputFile(`good POS
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF POS=0 0 0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 54);
      expect(err).toBeUndefined();
    });

    it('check 54: skips POS distribution reference', () => {
      const doc = parseInputFile(`POS dist
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF POS=D1
SI1 L 0 0 0 1 1 1
SP1 0.5 0.5
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 54);
      expect(err).toBeUndefined();
    });
  });

  describe('check 55 — SDEF AXS/VEC value count', () => {
    it('check 55: flags AXS with wrong value count', () => {
      const doc = parseInputFile(`bad AXS
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF AXS=0 0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 55);
      expect(err).toBeDefined();
    });

    it('check 55: flags VEC with wrong value count', () => {
      const doc = parseInputFile(`bad VEC
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF VEC=1 0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 55);
      expect(err).toBeDefined();
    });

    it('check 55: no error for AXS with 3 values', () => {
      const doc = parseInputFile(`good AXS
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF AXS=0 0 1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 55);
      expect(err).toBeUndefined();
    });

    it('check 55: skips AXS distribution reference', () => {
      const doc = parseInputFile(`AXS dist
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF AXS=D1
SI1 L 0 0 1 1 0 0
SP1 0.5 0.5
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 55);
      expect(err).toBeUndefined();
    });
  });

  describe('check 56 — SDEF ERG positive', () => {
    it('check 56: flags negative ERG', () => {
      const doc = parseInputFile(`bad ERG
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF ERG=-1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 56);
      expect(err).toBeDefined();
    });

    it('check 56: flags zero ERG', () => {
      const doc = parseInputFile(`zero ERG
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF ERG=0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 56);
      expect(err).toBeDefined();
    });

    it('check 56: no error for positive ERG', () => {
      const doc = parseInputFile(`good ERG
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF ERG=14.1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 56);
      expect(err).toBeUndefined();
    });

    it('check 56: skips ERG distribution reference', () => {
      const doc = parseInputFile(`ERG dist
1 0 -1 IMP:N=1
2 0  1 IMP:N=0

1 SO 5.0

SDEF ERG=D1
SI1 H 0 1 2
SP1 0 0.5 0.5
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 56);
      expect(err).toBeUndefined();
    });
  });

  describe('check 57 — KSRC point count', () => {
    it('check 57: flags KSRC with non-multiple-of-3 values', () => {
      const doc = parseInputFile(`bad KSRC
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
KCODE 1000 1.0 10 50
KSRC 0 0 0 1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 57);
      expect(err).toBeDefined();
      expect(err!.message).toMatch(/multiple of 3/);
    });

    it('check 57: no error for valid KSRC', () => {
      const doc = parseInputFile(`good KSRC
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
KCODE 1000 1.0 10 50
KSRC 0 0 0 1 1 1
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 57);
      expect(err).toBeUndefined();
    });
  });

  describe('cell parameter validation (checks 58–60)', () => {
    it('check 58: flags unrecognized cell parameter', () => {
      const doc = parseInputFile(`bad param
1 1 -2.7 -1 IMP:N=1 FOOBAR=5
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 58);
      expect(err).toBeDefined();
      expect(err!.message).toMatch(/FOOBAR/);
    });

    it('check 58: suggests close match for typo', () => {
      const doc = parseInputFile(`typo param
1 1 -2.7 -1 IMP:N=1 IMPP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 58);
      expect(err).toBeDefined();
      expect(err!.message).toContain('IMPP');
      expect(err!.message).toContain("did you mean 'IMP'");
    });

    it('check 58: no warning for recognized parameters', () => {
      const doc = parseInputFile(`good params
1 1 -2.7 -1 IMP:N=1 TMP=2.53e-8 VOL=100 U=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 58);
      expect(err).toBeUndefined();
    });

    it('check 58: handles particle suffix correctly', () => {
      const doc = parseInputFile(`particle suffix
1 1 -2.7 -1 IMP:N,P=1 EXT:N=0 FCL:N=0
2 0       1 IMP:N,P=0

1 SO 5.0

M1 13027.80c 1.0
MODE N P
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 58);
      expect(err).toBeUndefined();
    });

    it('check 59: flags non-positive TMP', () => {
      const doc = parseInputFile(`bad TMP
1 1 -2.7 -1 IMP:N=1 TMP=0
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 59);
      expect(err).toBeDefined();
      expect(err!.severity).toBe('error');
    });

    it('check 59: no error for positive TMP', () => {
      const doc = parseInputFile(`good TMP
1 1 -2.7 -1 IMP:N=1 TMP=2.53e-8
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 59);
      expect(err).toBeUndefined();
    });

    it('check 60: flags negative IMP value', () => {
      const doc = parseInputFile(`negative IMP
1 1 -2.7 -1 IMP:N=-1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 60);
      expect(err).toBeDefined();
      expect(err!.severity).toBe('error');
    });

    it('check 60: no error for IMP=0 (graveyard)', () => {
      const doc = parseInputFile(`imp zero ok
1 1 -2.7 -1 IMP:N=1
2 0       1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
SDEF ERG=1.0
NPS 1000
`);
      const diags = validateCrossReferences(doc);
      const err = diags.find(d => d.checkNumber === 60);
      expect(err).toBeUndefined();
    });
  });

  describe('check 63: elemental ZAID with xsdir — isotopic forms available', () => {
    it('63: suggests isotopic expansion when isotopic ZAIDs exist in xsdir', () => {
      const input = `check 63 xsdir
1  1  -2.7  -1  IMP:N=1
2  0         1  IMP:N=0

1  SO  5.0

M1  6000.00c -1.0
NPS 1000
`;
      const doc = parseInputFile(input);
      const xsdir = parseXsdir(readFileSync(join(__dirname, '../fixtures/mock-xsdir'), 'utf-8'));
      const errors = validateCrossReferences(doc, { xsdirData: xsdir });
      const check63 = errors.filter(e => e.checkNumber === 63);
      expect(check63.length).toBe(1);
      expect(check63[0].severity).toBe('info');
      expect(check63[0].message).toContain('Elemental ZAID 6000.00c');
      expect(check63[0].message).toContain('6012.00c');
      expect(check63[0].message).toContain('6013.00c');
      // Should NOT produce a check 17 warning for this ZAID
      const check17for6000 = errors.filter(e => e.checkNumber === 17 && e.message.includes('6000'));
      expect(check17for6000.length).toBe(0);
    });
  });

  describe('check 63: elemental ZAID info hint without xsdir', () => {
    it('63: elemental ZAID info hint when no xsdir', () => {
      const input = `check 63
1  1  -2.7  -1  IMP:N=1
2  0         1  IMP:N=0

1  SO  5.0

M1  6000 -0.13  8016.80c -0.87
NPS 1000
`;
      const doc = parseInputFile(input);
      const errors = validateCrossReferences(doc);
      const check63 = errors.filter(e => e.checkNumber === 63);
      expect(check63.length).toBe(1);
      expect(check63[0].severity).toBe('info');
      expect(check63[0].message).toContain('6000');
    });

    it('63: no hint for isotopic ZAID without xsdir', () => {
      const input = `check 63 isotopic
1  1  -2.7  -1  IMP:N=1
2  0         1  IMP:N=0

1  SO  5.0

M1  6012.80c -0.13  8016.80c -0.87
NPS 1000
`;
      const doc = parseInputFile(input);
      const errors = validateCrossReferences(doc);
      const check63 = errors.filter(e => e.checkNumber === 63);
      expect(check63.length).toBe(0);
    });

    it('63: no hint for synthetic element without xsdir', () => {
      const input = `check 63 synthetic
1  1  -2.7  -1  IMP:N=1
2  0         1  IMP:N=0

1  SO  5.0

M1  43000 -1.0
NPS 1000
`;
      const doc = parseInputFile(input);
      const errors = validateCrossReferences(doc);
      const check63 = errors.filter(e => e.checkNumber === 63);
      expect(check63.length).toBe(0);
    });
  });

  describe('check 64: ZAID missing fraction in material card', () => {
    it('64: error when ZAID has no following fraction', () => {
      const input = `check 64 missing fraction
1  1  -1.0  -1  IMP:N=1
2  0          1  IMP:N=0

1 PX 0

M1 1001.70c
`;
      const doc = parseInputFile(input);
      const errors = validateCrossReferences(doc);
      const check64 = errors.filter(e => e.checkNumber === 64);
      expect(check64.length).toBe(1);
      expect(check64[0].severity).toBe('error');
      expect(check64[0].message).toContain('1001.70c');
      expect(check64[0].message).toContain('M1');
    });

    it('64: no error when all ZAIDs have fractions', () => {
      const input = `check 64 valid
1  1  -1.0  -1  IMP:N=1
2  0          1  IMP:N=0

1 PX 0

M1 1001.70c 0.667 8016.70c 0.333
`;
      const doc = parseInputFile(input);
      const errors = validateCrossReferences(doc);
      const check64 = errors.filter(e => e.checkNumber === 64);
      expect(check64.length).toBe(0);
    });

    it('64: error only for ZAID missing fraction, not keyword', () => {
      const input = `check 64 keyword after zaid
1  1  -1.0  -1  IMP:N=1
2  0          1  IMP:N=0

1 PX 0

M1 1001.70c NLIB=70c
`;
      const doc = parseInputFile(input);
      const errors = validateCrossReferences(doc);
      const check64 = errors.filter(e => e.checkNumber === 64);
      expect(check64.length).toBe(1);
      expect(check64[0].message).toContain('1001.70c');
    });
  });

  describe('suppressChecks option', () => {
    it('suppresses check-1 errors while other errors remain', () => {
      const doc = parseInputFile(`suppress check 1 test
1  0  -1 -99
2  0   1  IMP:N=0

1  SO  5.0

NPS 1000
`);
      // Without suppression: surface 99 not defined (check 1)
      const allErrors = validateCrossReferences(doc);
      expect(allErrors.some(e => e.checkNumber === 1)).toBe(true);

      // With suppressChecks: [1], check-1 error should be absent
      const suppressed = validateCrossReferences(doc, { suppressChecks: [1] });
      expect(suppressed.some(e => e.checkNumber === 1)).toBe(false);

      // Other errors/warnings (e.g. void cell with no IMP) should still be present
      expect(suppressed.length).toBeLessThan(allErrors.length);
    });
  });
});
