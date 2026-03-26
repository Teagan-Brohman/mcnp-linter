import { describe, it, expect } from 'vitest';
import { parseInputFile } from '../../server/src/parser/inputFile';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('parseInputFile', () => {
  it('parses the simple fixture into a complete document', () => {
    const text = readFileSync(join(__dirname, '../fixtures/simple.i'), 'utf-8');
    const doc = parseInputFile(text);

    expect(doc.title).toBe('simple test problem');
    expect(doc.cells).toHaveLength(2);
    expect(doc.surfaces).toHaveLength(1);
    expect(doc.materials).toHaveLength(1);

    // Cell 1 references surface 1 and material 1
    expect(doc.cells[0].id).toBe(1);
    expect(doc.cells[0].materialId).toBe(1);
    expect(doc.cells[0].geometry.surfaceRefs[0].id).toBe(1);

    // Cell 2 is void
    expect(doc.cells[1].materialId).toBe(0);

    // Surface 1 is a sphere
    expect(doc.surfaces[0].type).toBe('SO');

    // Material 1 has aluminum
    expect(doc.materials[0].components[0].z).toBe(13);
  });

  it('handles inline text without file', () => {
    const doc = parseInputFile(`test
1  1  -1.0  -1

1  SO  5

M1  1001.80c  1.0
`);
    expect(doc.cells).toHaveLength(1);
    expect(doc.surfaces).toHaveLength(1);
    expect(doc.materials).toHaveLength(1);
  });

  it('handles empty input gracefully', () => {
    const doc = parseInputFile('');
    expect(doc.cells).toHaveLength(0);
    expect(doc.surfaces).toHaveLength(0);
  });

  it('handles input with only title', () => {
    const doc = parseInputFile('just a title');
    expect(doc.title).toBe('just a title');
    expect(doc.cells).toHaveLength(0);
  });

  it('skips non-material data cards', () => {
    const doc = parseInputFile(`test
1  0  -1

1  SO  5

M1  1001.80c  1.0
NPS  1000
MODE  N P
`);
    expect(doc.materials).toHaveLength(1);
    // NPS and MODE should not appear as materials
  });

  it('collects parse errors without crashing', () => {
    // A line that can't be parsed as a cell card
    const doc = parseInputFile(`test
BADLINE

1  SO  5

M1  1001.80c  1.0
`);
    // Should have either 0 cells (skipped) or a parse error, but not crash
    expect(doc.surfaces).toHaveLength(1);
  });
});
