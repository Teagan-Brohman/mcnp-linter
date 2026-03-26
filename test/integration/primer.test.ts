import { describe, it, expect } from 'vitest';
import { parseInputFile } from '../../server/src/parser/inputFile';
import { validateCrossReferences } from '../../server/src/analysis/crossReference';
import { getSurfaceHover } from '../../server/src/hover/surfaceHover';
import { getZaidHover } from '../../server/src/hover/zaidHover';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('primer: cask problem', () => {
  const text = readFileSync(join(__dirname, '../fixtures/primer-cask.i'), 'utf-8');
  const doc = parseInputFile(text);
  const errors = validateCrossReferences(doc);

  it('parses 3 cells', () => {
    expect(doc.cells).toHaveLength(3);
  });

  it('parses cell 8 as void inside cask', () => {
    const cell8 = doc.cells.find(c => c.id === 8);
    expect(cell8).toBeDefined();
    expect(cell8!.materialId).toBe(0);
  });

  it('parses cell 7 with material 5 (iron) and density -7.86', () => {
    const cell7 = doc.cells.find(c => c.id === 7);
    expect(cell7).toBeDefined();
    expect(cell7!.materialId).toBe(5);
    expect(cell7!.density).toBeCloseTo(-7.86);
  });

  it('parses 2 macrobody surfaces (RCC)', () => {
    expect(doc.surfaces).toHaveLength(2);
    expect(doc.surfaces[0].type).toBe('RCC');
    expect(doc.surfaces[1].type).toBe('RCC');
  });

  it('parses RCC 17 parameters correctly', () => {
    const s17 = doc.surfaces.find(s => s.id === 17);
    expect(s17).toBeDefined();
    expect(s17!.parameters).toEqual([5, 5, 40, 0, 0, 20, 10]);
  });

  it('parses materials M5 and M21', () => {
    expect(doc.materials.length).toBeGreaterThanOrEqual(2);
    const m5 = doc.materials.find(m => m.id === 5);
    const m21 = doc.materials.find(m => m.id === 21);
    expect(m5).toBeDefined();
    expect(m21).toBeDefined();
  });

  it('M21 has H-1 and O-16 components', () => {
    const m21 = doc.materials.find(m => m.id === 21);
    expect(m21!.components).toHaveLength(2);
    expect(m21!.components[0].z).toBe(1);   // hydrogen
    expect(m21!.components[0].a).toBe(1);
    expect(m21!.components[1].z).toBe(8);   // oxygen
    expect(m21!.components[1].a).toBe(16);
  });

  it('has no cross-reference errors', () => {
    const realErrors = errors.filter(e => e.severity !== 'info');
    expect(realErrors).toHaveLength(0);
  });

  it('surface hover for RCC 17 shows macrobody info', () => {
    const hover = getSurfaceHover(doc, 17);
    expect(hover).toBeDefined();
    expect(hover).toContain('RCC');
  });

  it('parses SDEF with ERG, PAR, and POS', () => {
    expect(doc.sdefCards).toHaveLength(1);
    expect(doc.sdefCards[0].keywords.get('ERG')).toBe('1.25');
    expect(doc.sdefCards[0].keywords.get('PAR')).toBe('2');
    expect(doc.sdefCards[0].keywords.get('POS')).toBe('5 5 50');
  });

  it('parses MODE P', () => {
    expect(doc.modeCards).toHaveLength(1);
    expect(doc.modeCards[0].particles).toEqual(['P']);
  });

  it('parses NPS 10000', () => {
    expect(doc.npsCards).toHaveLength(1);
    expect(doc.npsCards[0].count).toBe(10000);
  });
});

describe('primer: iron shell problem', () => {
  const text = readFileSync(join(__dirname, '../fixtures/primer-iron-shell.i'), 'utf-8');
  const doc = parseInputFile(text);
  const errors = validateCrossReferences(doc);

  it('parses 5 cells', () => {
    expect(doc.cells).toHaveLength(5);
  });

  it('parses cell 20 with material 1 iron', () => {
    const cell20 = doc.cells.find(c => c.id === 20);
    expect(cell20).toBeDefined();
    expect(cell20!.materialId).toBe(1);
    expect(cell20!.density).toBeCloseTo(-7.86);
  });

  it('parses 4 sphere surfaces', () => {
    expect(doc.surfaces).toHaveLength(4);
    for (const s of doc.surfaces) {
      expect(s.type).toBe('SO');
    }
  });

  it('parses Fortran scientific notation: 10.E+02 = 1000', () => {
    const s100 = doc.surfaces.find(s => s.id === 100);
    expect(s100).toBeDefined();
    expect(s100!.parameters[0]).toBeCloseTo(1000);
  });

  it('parses M1 natural iron (ZAID 26000)', () => {
    const m1 = doc.materials.find(m => m.id === 1);
    expect(m1).toBeDefined();
    expect(m1!.components[0].z).toBe(26);
    expect(m1!.components[0].a).toBe(0);  // natural element
  });

  it('has no cross-reference errors', () => {
    const realErrors = errors.filter(e => e.severity !== 'info');
    expect(realErrors).toHaveLength(0);
  });

  it('cell 10 references surface 10', () => {
    const cell10 = doc.cells.find(c => c.id === 10);
    expect(cell10!.geometry.surfaceRefs.some(r => r.id === 10)).toBe(true);
  });

  it('cell 20 references surfaces 10 and 20', () => {
    const cell20 = doc.cells.find(c => c.id === 20);
    const refIds = cell20!.geometry.surfaceRefs.map(r => r.id);
    expect(refIds).toContain(10);
    expect(refIds).toContain(20);
  });

  it('ZAID hover for natural iron shows element info', () => {
    const m1 = doc.materials.find(m => m.id === 1)!;
    const entry = m1.components[0];
    const hover = getZaidHover(doc, entry, m1);
    expect(hover).toContain('Iron');
    expect(hover).toContain('natural');
  });

  it('parses SDEF with ERG and PAR', () => {
    expect(doc.sdefCards).toHaveLength(1);
    expect(doc.sdefCards[0].keywords.get('ERG')).toBe('7.00');
    expect(doc.sdefCards[0].keywords.get('PAR')).toBe('2');
  });

  it('parses MODE P', () => {
    expect(doc.modeCards).toHaveLength(1);
    expect(doc.modeCards[0].particles).toEqual(['P']);
  });

  it('parses NPS 10000', () => {
    expect(doc.npsCards).toHaveLength(1);
    expect(doc.npsCards[0].count).toBe(10000);
  });
});
