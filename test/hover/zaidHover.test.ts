import { describe, it, expect } from 'vitest';
import { getZaidHover } from '../../server/src/hover/zaidHover';
import { ZaidEntry, MaterialCard, McnpDocument, SourceRange } from '../../server/src/types';

const range: SourceRange = { startLine: 0, startCol: 0, endLine: 0, endCol: 10 };

function makeEntry(overrides: Partial<ZaidEntry> & { zaid: string; z: number; a: number; fraction: number }): ZaidEntry {
  return { library: undefined, range, ...overrides };
}

function makeMat(id: number, components: ZaidEntry[] = [], keywords: Map<string, string> = new Map()): MaterialCard {
  return { id, components, keywords, range };
}

const EMPTY_DOC: McnpDocument = {
  title: 'test',
  cells: [], surfaces: [], materials: [],
  thermalCards: [], parameterDataCards: [], readCards: [],
  tallyCards: [], tallyModifiers: [],
  transformCards: [], modeCards: [], npsCards: [], ctmeCards: [],
  kcodeCards: [], ksrcCards: [], sdefCards: [], sourceDistCards: [],
  impCards: [], parseErrors: [],
  blockCount: 3, hasBrokenBlockStructure: false,
};

function makeDoc(materials: MaterialCard[] = []): McnpDocument {
  return { ...EMPTY_DOC, materials };
}

describe('getZaidHover', () => {
  it('shows isotope name and library for explicit suffix', () => {
    const entry = makeEntry({ zaid: '92235.80c', z: 92, a: 235, library: '80c', fraction: 0.04 });
    const mat = makeMat(1, [entry]);
    const hover = getZaidHover(makeDoc([mat]), entry, mat);
    expect(hover).toContain('Uranium-235');
    expect(hover).toContain('U-235');
    expect(hover).toContain('ENDF/B-VII.1');
    expect(hover).toContain('.80c');
    expect(hover).not.toContain('via'); // explicit suffix doesn't show source
  });

  it('resolves library from NLIB when no explicit suffix', () => {
    const entry = makeEntry({ zaid: '92235', z: 92, a: 235, fraction: 0.04 });
    const mat = makeMat(1, [entry], new Map([['NLIB', '80c']]));
    const hover = getZaidHover(makeDoc([mat]), entry, mat);
    expect(hover).toContain('Uranium-235');
    expect(hover).toContain('ENDF/B-VII.1');
    expect(hover).toContain('.80c');
    expect(hover).toContain('via NLIB');
  });

  it('resolves library from M0 global defaults', () => {
    const entry = makeEntry({ zaid: '1001', z: 1, a: 1, fraction: 1.0 });
    const mat = makeMat(1, [entry]);
    const m0 = makeMat(0, [], new Map([['NLIB', '70c']]));
    const hover = getZaidHover(makeDoc([mat, m0]), entry, mat);
    expect(hover).toContain('Hydrogen-1');
    expect(hover).toContain('ENDF/B-VII.0');
    expect(hover).toContain('.70c');
    expect(hover).toContain('via M0 NLIB');
  });

  it('shows natural element for A=0', () => {
    const entry = makeEntry({ zaid: '92000', z: 92, a: 0, fraction: 1.0 });
    const mat = makeMat(1, [entry]);
    const hover = getZaidHover(makeDoc([mat]), entry, mat);
    expect(hover).toContain('Uranium');
    expect(hover).toContain('natural');
  });

  it('shows isotope name even without library info', () => {
    const entry = makeEntry({ zaid: '26056', z: 26, a: 56, fraction: 1.0 });
    const mat = makeMat(1, [entry]);
    const hover = getZaidHover(makeDoc([mat]), entry, mat);
    expect(hover).toContain('Iron-56');
    expect(hover).toContain('Fe-56');
  });

  it('prefers explicit suffix over NLIB', () => {
    const entry = makeEntry({ zaid: '92235.80c', z: 92, a: 235, library: '80c', fraction: 0.04 });
    const mat = makeMat(1, [entry], new Map([['NLIB', '70c']]));
    const hover = getZaidHover(makeDoc([mat]), entry, mat);
    expect(hover).toContain('.80c');
    expect(hover).toContain('ENDF/B-VII.1');
    expect(hover).not.toContain('via'); // explicit, no source shown
  });

  it('shows other library defaults (PLIB, ELIB) on material', () => {
    const entry = makeEntry({ zaid: '92235.80c', z: 92, a: 235, library: '80c', fraction: 0.04 });
    const mat = makeMat(1, [entry], new Map([['PLIB', '04p'], ['ELIB', '03e']]));
    const hover = getZaidHover(makeDoc([mat]), entry, mat);
    expect(hover).toContain('PLIB=.04p');
    expect(hover).toContain('ELIB=.03e');
  });

  it('shows library defaults inherited from M0', () => {
    const entry = makeEntry({ zaid: '92235', z: 92, a: 235, fraction: 0.04 });
    const mat = makeMat(1, [entry], new Map([['NLIB', '80c']]));
    const m0 = makeMat(0, [], new Map([['PLIB', '04p']]));
    const hover = getZaidHover(makeDoc([mat, m0]), entry, mat);
    expect(hover).toContain('via NLIB');
    expect(hover).toContain('PLIB=.04p (M0)');
  });

  it('does not duplicate NLIB in other defaults when used for resolution', () => {
    const entry = makeEntry({ zaid: '92235', z: 92, a: 235, fraction: 0.04 });
    const mat = makeMat(1, [entry], new Map([['NLIB', '80c'], ['PLIB', '04p']]));
    const hover = getZaidHover(makeDoc([mat]), entry, mat);
    expect(hover).toContain('via NLIB');
    expect(hover).toContain('PLIB=.04p');
    expect(hover).not.toContain('NLIB=.80c');
  });
});
