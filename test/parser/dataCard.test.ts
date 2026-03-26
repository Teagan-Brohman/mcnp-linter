import { describe, it, expect } from 'vitest';
import { parseMaterialCard, isMaterialCard, isThermalCard, parseThermalCard, isParameterDataCard, parseParameterDataCard, isReadCard, parseReadCard, isModeCard, parseModeCard, isNpsCard, parseNpsCard, isCtmeCard, parseCtmeCard, isKcodeCard, parseKcodeCard, isKsrcCard, parseKsrcCard, isSdefCard, parseSdefCard, isSourceDistCard, parseSourceDistCard, isImpCard, parseImpCard } from '../../server/src/parser/dataCard';
import { LogicalLine } from '../../server/src/parser/tokenizer';

function makeLine(text: string, startLine = 0): LogicalLine {
  return { text, startLine, endLine: startLine, originalLines: [text] };
}

describe('isMaterialCard', () => {
  it('identifies M1', () => { expect(isMaterialCard('M1  13027.80c 1.0')).toBe(true); });
  it('identifies m10 (case insensitive)', () => { expect(isMaterialCard('m10  92235 0.04')).toBe(true); });
  it('rejects MODE', () => { expect(isMaterialCard('MODE N P')).toBe(false); });
  it('rejects MESH', () => { expect(isMaterialCard('MESH geom=xyz')).toBe(false); });
  it('rejects MT1 (thermal scattering)', () => { expect(isMaterialCard('MT1 lwtr.20t')).toBe(false); });
  it('rejects MX1 (material substitution)', () => { expect(isMaterialCard('MX1 1001 8016')).toBe(false); });
  it('identifies M0 (global defaults)', () => { expect(isMaterialCard('M0 NLIB=80c')).toBe(true); });
  it('rejects MPHYS', () => { expect(isMaterialCard('MPHYS ON')).toBe(false); });
  it('rejects MGOPT', () => { expect(isMaterialCard('MGOPT F 10')).toBe(false); });
  it('rejects MPLOT', () => { expect(isMaterialCard('MPLOT')).toBe(false); });
  it('identifies indented material card', () => { expect(isMaterialCard('  M1  13027.80c 1.0')).toBe(true); });
  it('rejects indented non-material', () => { expect(isMaterialCard('  MODE N P')).toBe(false); });
});

describe('parseMaterialCard', () => {
  it('parses indented material card with keywords', () => {
    const m = parseMaterialCard(makeLine('  M5  92235.80c 0.04  NLIB=80c PLIB=04p'));
    expect(m.id).toBe(5);
    expect(m.components).toHaveLength(1);
    expect(m.components[0].z).toBe(92);
    expect(m.keywords.get('NLIB')).toBe('80c');
    expect(m.keywords.get('PLIB')).toBe('04p');
  });

  it('parses simple: M1 13027.80c 1.0', () => {
    const m = parseMaterialCard(makeLine('M1  13027.80c  1.0'));
    expect(m.id).toBe(1);
    expect(m.components).toHaveLength(1);
    expect(m.components[0].z).toBe(13);
    expect(m.components[0].a).toBe(27);
    expect(m.components[0].library).toBe('80c');
    expect(m.components[0].fraction).toBe(1.0);
  });

  it('parses multi-component with keywords', () => {
    const m = parseMaterialCard(makeLine('M1  6012.50c 1  8016.01p 2  NLIB=60c PLIB=02p'));
    expect(m.components).toHaveLength(2);
    expect(m.keywords.get('NLIB')).toBe('60c');
    expect(m.keywords.get('PLIB')).toBe('02p');
  });

  it('parses ZAID without library suffix', () => {
    const m = parseMaterialCard(makeLine('M2  1001 0.6667 8016 0.3333'));
    expect(m.components[0].z).toBe(1);
    expect(m.components[0].a).toBe(1);
    expect(m.components[0].library).toBeUndefined();
    expect(m.components[1].z).toBe(8);
    expect(m.components[1].a).toBe(16);
  });

  it('parses natural element (AAA=000)', () => {
    const m = parseMaterialCard(makeLine('M3  92000 1.0'));
    expect(m.components[0].z).toBe(92);
    expect(m.components[0].a).toBe(0);
  });

  it('parses negative fractions (weight fractions)', () => {
    const m = parseMaterialCard(makeLine('M4  26000 -1.0'));
    expect(m.components[0].fraction).toBe(-1.0);
  });

  it('parses M0 card with only keywords', () => {
    const m = parseMaterialCard(makeLine('M0  NLIB=80c PLIB=04p'));
    expect(m.id).toBe(0);
    expect(m.components).toHaveLength(0);
    expect(m.keywords.get('NLIB')).toBe('80c');
    expect(m.keywords.get('PLIB')).toBe('04p');
  });

  it('handles keywords mixed among ZAID-fraction pairs', () => {
    const m = parseMaterialCard(makeLine('M1  NLIB=50D  1001 2  8016.50C 1  6012 1'));
    expect(m.keywords.get('NLIB')).toBe('50D');
    expect(m.components).toHaveLength(3);
  });
});

describe('isThermalCard', () => {
  it('identifies MT1', () => { expect(isThermalCard('MT1 lwtr.10t')).toBe(true); });
  it('identifies mt10 (case insensitive)', () => { expect(isThermalCard('mt10 grph.10t')).toBe(true); });
  it('rejects MODE', () => { expect(isThermalCard('MODE N P')).toBe(false); });
  it('rejects M1 (material card)', () => { expect(isThermalCard('M1 13027.80c 1.0')).toBe(false); });
  it('rejects MX1', () => { expect(isThermalCard('MX1 1001 8016')).toBe(false); });
});

describe('parseThermalCard', () => {
  it('parses single table: MT1 lwtr.10t', () => {
    const tc = parseThermalCard(makeLine('MT1  lwtr.10t'));
    expect(tc.id).toBe(1);
    expect(tc.tables).toHaveLength(1);
    expect(tc.tables[0].name).toBe('lwtr.10t');
    expect(tc.tables[0].identifier).toBe('lwtr');
    expect(tc.tables[0].suffix).toBe('10t');
  });

  it('parses multiple tables: MT2 lwtr.10t grph.10t', () => {
    const tc = parseThermalCard(makeLine('MT2  lwtr.10t  grph.10t'));
    expect(tc.id).toBe(2);
    expect(tc.tables).toHaveLength(2);
    expect(tc.tables[0].identifier).toBe('lwtr');
    expect(tc.tables[1].identifier).toBe('grph');
  });

  it('parses case insensitive: mt3 hwtr.20t', () => {
    const tc = parseThermalCard(makeLine('mt3  hwtr.20t'));
    expect(tc.id).toBe(3);
    expect(tc.tables[0].name).toBe('hwtr.20t');
  });

  it('table ranges point to correct positions', () => {
    const tc = parseThermalCard(makeLine('MT1  lwtr.10t  grph.10t'));
    // "MT1  lwtr.10t  grph.10t"
    //       ^         ^
    expect(tc.tables[0].range.startCol).toBe(5);
    expect(tc.tables[0].range.endCol).toBe(5 + 'lwtr.10t'.length);
    expect(tc.tables[1].range.startCol).toBe(15);
    expect(tc.tables[1].range.endCol).toBe(15 + 'grph.10t'.length);
  });

  it('handles table without suffix', () => {
    const tc = parseThermalCard(makeLine('MT1  lwtr'));
    expect(tc.tables[0].name).toBe('lwtr');
    expect(tc.tables[0].identifier).toBe('lwtr');
    expect(tc.tables[0].suffix).toBe('');
  });
});

describe('READ card', () => {
  it('recognizes READ FILE= syntax', () => {
    expect(isReadCard('READ FILE=input2.i')).toBe(true);
    expect(isReadCard('read file=other.inp')).toBe(true);
    expect(isReadCard('M1 1001.80c 1.0')).toBe(false);
  });
  it('parses READ card extracting filename', () => {
    const line = makeLine('READ FILE=geom_cells.i', 10);
    const card = parseReadCard(line);
    expect(card.filename).toBe('geom_cells.i');
    expect(card.range.startLine).toBe(10);
  });
});

describe('MODE card', () => {
  it('detects MODE card', () => {
    expect(isModeCard('MODE N P')).toBe(true);
    expect(isModeCard('mode n')).toBe(true);
    expect(isModeCard('MODE N P E')).toBe(true);
    expect(isModeCard('M1 1001.80c 1.0')).toBe(false);
    expect(isModeCard('MPLOT')).toBe(false);
  });

  it('parses MODE N P', () => {
    const line = { text: 'MODE N P', startLine: 10, endLine: 10, originalLines: ['MODE N P'] };
    const result = parseModeCard(line);
    expect(result.particles).toEqual(['N', 'P']);
  });

  it('parses MODE N P E (case-insensitive)', () => {
    const line = { text: 'mode n p e', startLine: 5, endLine: 5, originalLines: ['mode n p e'] };
    const result = parseModeCard(line);
    expect(result.particles).toEqual(['N', 'P', 'E']);
  });

  it('parses MODE N (single particle)', () => {
    const line = { text: 'MODE N', startLine: 0, endLine: 0, originalLines: ['MODE N'] };
    const result = parseModeCard(line);
    expect(result.particles).toEqual(['N']);
  });
});

describe('NPS card', () => {
  it('detects NPS card', () => {
    expect(isNpsCard('NPS 10000')).toBe(true);
    expect(isNpsCard('nps 1e6')).toBe(true);
    expect(isNpsCard('NPS1000')).toBe(false);
    expect(isNpsCard('NPSOMETHING')).toBe(false);
  });

  it('parses NPS 10000', () => {
    const line = { text: 'NPS 10000', startLine: 20, endLine: 20, originalLines: ['NPS 10000'] };
    const result = parseNpsCard(line);
    expect(result.count).toBe(10000);
  });

  it('parses NPS with scientific notation', () => {
    const line = { text: 'NPS 1.0e7', startLine: 20, endLine: 20, originalLines: ['NPS 1.0e7'] };
    const result = parseNpsCard(line);
    expect(result.count).toBe(1e7);
  });
});

describe('CTME card', () => {
  it('detects CTME card', () => {
    expect(isCtmeCard('CTME 60')).toBe(true);
    expect(isCtmeCard('ctme 120.5')).toBe(true);
    expect(isCtmeCard('CUT:N')).toBe(false);
  });

  it('parses CTME 60', () => {
    const line = { text: 'CTME 60', startLine: 25, endLine: 25, originalLines: ['CTME 60'] };
    const result = parseCtmeCard(line);
    expect(result.minutes).toBe(60);
  });
});

describe('parameter data cards (U, LAT, FILL)', () => {
  it('recognizes U data card', () => {
    expect(isParameterDataCard('U 1 0 2')).toBe(true);
    expect(isParameterDataCard('u 1 0 2')).toBe(true);
  });

  it('recognizes LAT data card', () => {
    expect(isParameterDataCard('LAT 0 0 1')).toBe(true);
  });

  it('recognizes FILL data card', () => {
    expect(isParameterDataCard('FILL 0 5 0')).toBe(true);
  });

  it('does not match material cards', () => {
    expect(isParameterDataCard('M1 1001.80c 1.0')).toBe(false);
  });

  it('does not match U-235 style ZAIDs', () => {
    expect(isParameterDataCard('U235 1.0')).toBe(false);
  });

  it('does not match UNIVT or other U-prefixed keywords', () => {
    expect(isParameterDataCard('UNIVT 1 2 3')).toBe(false);
  });

  it('parses U data card values', () => {
    const line: LogicalLine = {
      text: 'U 1 0 2 0 3',
      startLine: 20, endLine: 20,
      originalLines: ['U 1 0 2 0 3'],
      originalLineNumbers: [20],
    };
    const card = parseParameterDataCard(line);
    expect(card.keyword).toBe('U');
    expect(card.values).toEqual([1, 0, 2, 0, 3]);
  });

  it('parses LAT data card values', () => {
    const line: LogicalLine = {
      text: 'LAT 0 0 1 0 2',
      startLine: 21, endLine: 21,
      originalLines: ['LAT 0 0 1 0 2'],
      originalLineNumbers: [21],
    };
    const card = parseParameterDataCard(line);
    expect(card.keyword).toBe('LAT');
    expect(card.values).toEqual([0, 0, 1, 0, 2]);
  });
});

describe('SDEF card', () => {
  it('detects SDEF card', () => {
    expect(isSdefCard('SDEF ERG=7.0 PAR=2')).toBe(true);
    expect(isSdefCard('sdef pos=0 0 0')).toBe(true);
    expect(isSdefCard('SF21 1 2 3')).toBe(false);
    expect(isSdefCard('SD15 1.0')).toBe(false);
  });

  it('parses SDEF with simple keywords', () => {
    const line = {
      text: 'SDEF ERG=7.0 PAR=2',
      startLine: 10, endLine: 10,
      originalLines: ['SDEF ERG=7.0 PAR=2'],
    };
    const result = parseSdefCard(line);
    expect(result.keywords.get('ERG')).toBe('7.0');
    expect(result.keywords.get('PAR')).toBe('2');
  });

  it('parses SDEF with distribution references', () => {
    const line = {
      text: 'SDEF CEL=D1 ERG=D2 POS=0 0 0',
      startLine: 10, endLine: 10,
      originalLines: ['SDEF CEL=D1 ERG=D2 POS=0 0 0'],
    };
    const result = parseSdefCard(line);
    expect(result.keywords.get('CEL')).toBe('D1');
    expect(result.keywords.get('ERG')).toBe('D2');
    expect(result.keywords.get('POS')).toBe('0 0 0');
  });

  it('parses SDEF with multi-value keywords (POS, AXS)', () => {
    const line = {
      text: 'SDEF POS=1.0 2.0 3.0 AXS=0 0 1 ERG=14.1',
      startLine: 10, endLine: 10,
      originalLines: ['SDEF POS=1.0 2.0 3.0 AXS=0 0 1 ERG=14.1'],
    };
    const result = parseSdefCard(line);
    expect(result.keywords.get('POS')).toBe('1.0 2.0 3.0');
    expect(result.keywords.get('AXS')).toBe('0 0 1');
    expect(result.keywords.get('ERG')).toBe('14.1');
  });

  it('parses SDEF from primer (ERG=7.00 PAR=2)', () => {
    const line = {
      text: 'SDEF  erg=7.00  par=2',
      startLine: 31, endLine: 31,
      originalLines: ['SDEF  erg=7.00  par=2'],
    };
    const result = parseSdefCard(line);
    expect(result.keywords.get('ERG')).toBe('7.00');
    expect(result.keywords.get('PAR')).toBe('2');
  });

  it('parses SDEF from primer-cask (ERG, PAR, POS)', () => {
    const line = {
      text: 'SDEF  ERG=1.25  PAR=2  POS=5 5 50',
      startLine: 23, endLine: 23,
      originalLines: ['SDEF  ERG=1.25  PAR=2  POS=5 5 50'],
    };
    const result = parseSdefCard(line);
    expect(result.keywords.get('ERG')).toBe('1.25');
    expect(result.keywords.get('PAR')).toBe('2');
    expect(result.keywords.get('POS')).toBe('5 5 50');
  });
});

describe('Source distribution cards', () => {
  it('detects SI/SP/SB/DS cards', () => {
    expect(isSourceDistCard('SI1 H 0 1 2 3')).toBe(true);
    expect(isSourceDistCard('SP1 0.1 0.2 0.3 0.4')).toBe(true);
    expect(isSourceDistCard('SB2 D 0.5 0.5')).toBe(true);
    expect(isSourceDistCard('DS3 S 1 2 3')).toBe(true);
    expect(isSourceDistCard('sp10 -21 0.965')).toBe(true);
    expect(isSourceDistCard('SDEF ERG=D1')).toBe(false);
    expect(isSourceDistCard('SO 5.0')).toBe(false);
  });

  it('parses SI1 H 0 1 2 3', () => {
    const line = {
      text: 'SI1 H 0 1 2 3',
      startLine: 15, endLine: 15,
      originalLines: ['SI1 H 0 1 2 3'],
    };
    const result = parseSourceDistCard(line);
    expect(result.cardType).toBe('SI');
    expect(result.distNumber).toBe(1);
    expect(result.option).toBe('H');
    expect(result.values).toEqual(['0', '1', '2', '3']);
  });

  it('parses SP1 with no option letter (default histogram)', () => {
    const line = {
      text: 'SP1 0.1 0.2 0.3 0.4',
      startLine: 16, endLine: 16,
      originalLines: ['SP1 0.1 0.2 0.3 0.4'],
    };
    const result = parseSourceDistCard(line);
    expect(result.cardType).toBe('SP');
    expect(result.distNumber).toBe(1);
    expect(result.option).toBeUndefined();
    expect(result.values).toEqual(['0.1', '0.2', '0.3', '0.4']);
  });

  it('parses SP with negative built-in function', () => {
    const line = {
      text: 'SP1 -21 0.965',
      startLine: 16, endLine: 16,
      originalLines: ['SP1 -21 0.965'],
    };
    const result = parseSourceDistCard(line);
    expect(result.cardType).toBe('SP');
    expect(result.values).toEqual(['-21', '0.965']);
  });

  it('parses DS3 S 1 2 3', () => {
    const line = {
      text: 'DS3 S 1 2 3',
      startLine: 18, endLine: 18,
      originalLines: ['DS3 S 1 2 3'],
    };
    const result = parseSourceDistCard(line);
    expect(result.cardType).toBe('DS');
    expect(result.distNumber).toBe(3);
    expect(result.option).toBe('S');
    expect(result.values).toEqual(['1', '2', '3']);
  });
});

describe('KCODE card', () => {
  it('detects KCODE card', () => {
    expect(isKcodeCard('KCODE 1000 1.0 10 50')).toBe(true);
    expect(isKcodeCard('kcode 5000 1.0 25 100')).toBe(true);
    expect(isKcodeCard('KSRC 0 0 0')).toBe(false);
    expect(isKcodeCard('KCODE')).toBe(false);
  });

  it('parses KCODE 1000 1.0 10 50', () => {
    const line = { text: 'KCODE 1000 1.0 10 50', startLine: 10, endLine: 10, originalLines: ['KCODE 1000 1.0 10 50'] };
    const result = parseKcodeCard(line);
    expect(result.nsrck).toBe(1000);
    expect(result.rkk).toBeCloseTo(1.0);
    expect(result.ikz).toBe(10);
    expect(result.kct).toBe(50);
  });

  it('parses KCODE with only required parameters', () => {
    const line = { text: 'KCODE 2000 1.0 15 100', startLine: 5, endLine: 5, originalLines: ['KCODE 2000 1.0 15 100'] };
    const result = parseKcodeCard(line);
    expect(result.nsrck).toBe(2000);
    expect(result.kct).toBe(100);
  });
});

describe('KSRC card', () => {
  it('detects KSRC card', () => {
    expect(isKsrcCard('KSRC 0 0 0')).toBe(true);
    expect(isKsrcCard('ksrc 1 2 3 4 5 6')).toBe(true);
    expect(isKsrcCard('KCODE 1000 1.0 10 50')).toBe(false);
    expect(isKsrcCard('KSRC')).toBe(false);
  });

  it('parses KSRC with one point', () => {
    const line = { text: 'KSRC 0 0 0', startLine: 10, endLine: 10, originalLines: ['KSRC 0 0 0'] };
    const result = parseKsrcCard(line);
    expect(result.points).toHaveLength(1);
    expect(result.points[0]).toEqual([0, 0, 0]);
  });

  it('parses KSRC with multiple points', () => {
    const line = { text: 'KSRC 1 2 3 4 5 6', startLine: 10, endLine: 10, originalLines: ['KSRC 1 2 3 4 5 6'] };
    const result = parseKsrcCard(line);
    expect(result.points).toHaveLength(2);
    expect(result.points[0]).toEqual([1, 2, 3]);
    expect(result.points[1]).toEqual([4, 5, 6]);
  });

  it('handles partial trailing point (ignores incomplete triple)', () => {
    const line = { text: 'KSRC 1 2 3 4', startLine: 10, endLine: 10, originalLines: ['KSRC 1 2 3 4'] };
    const result = parseKsrcCard(line);
    expect(result.points).toHaveLength(1); // only complete triple
  });
});

describe('IMP card (data-block form)', () => {
  it('detects IMP card', () => {
    expect(isImpCard('IMP:N 1 1 0')).toBe(true);
    expect(isImpCard('imp:n,p 1 1 0')).toBe(true);
    expect(isImpCard('IMP:N=1')).toBe(false);  // cell-param form, not data-block
    expect(isImpCard('IMPORTANT')).toBe(false);
  });

  it('parses IMP:N 1 1 1 0', () => {
    const line = { text: 'IMP:N 1 1 1 0', startLine: 10, endLine: 10, originalLines: ['IMP:N 1 1 1 0'] };
    const result = parseImpCard(line);
    expect(result.particles).toEqual(['N']);
    expect(result.values).toEqual([1, 1, 1, 0]);
  });

  it('parses combined IMP:N,P', () => {
    const line = { text: 'IMP:N,P 1 1 0 0', startLine: 10, endLine: 10, originalLines: ['IMP:N,P 1 1 0 0'] };
    const result = parseImpCard(line);
    expect(result.particles).toEqual(['N', 'P']);
    expect(result.values).toEqual([1, 1, 0, 0]);
  });

  it('parses case-insensitive', () => {
    const line = { text: 'imp:e 1 0 0', startLine: 5, endLine: 5, originalLines: ['imp:e 1 0 0'] };
    const result = parseImpCard(line);
    expect(result.particles).toEqual(['E']);
    expect(result.values).toEqual([1, 0, 0]);
  });
});
