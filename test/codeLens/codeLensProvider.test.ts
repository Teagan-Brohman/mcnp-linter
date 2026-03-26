import { describe, it, expect } from 'vitest';
import { getCodeLenses } from '../../server/src/codeLens/codeLensProvider';
import { parseInputFile } from '../../server/src/parser/inputFile';

const input = `code lens test
1  1  -2.7  -1 2  IMP:N=1
2  0        #1    IMP:N=0

1  SO  5.0
2  PX  10.0

M1  13027.80c  1.0
`;

describe('getCodeLenses', () => {
  const doc = parseInputFile(input);
  const uri = 'file:///test.mcnp';
  const lenses = getCodeLenses(doc, input, uri);

  it('shows reference count for cells that have references', () => {
    // Cell 1 is referenced by #1 in cell 2
    const cell1Lens = lenses.find(l => l.range.start.line === doc.cells[0].range.startLine);
    expect(cell1Lens).toBeDefined();
    expect(cell1Lens!.command!.title).toMatch(/reference/);
  });

  it('shows reference count for surfaces', () => {
    // Surface 1 used as -1 in cell 1
    const surf1Lens = lenses.find(l => l.range.start.line === doc.surfaces[0].range.startLine);
    expect(surf1Lens).toBeDefined();
    expect(surf1Lens!.command!.title).toMatch(/reference/);

    // Surface 2 used as 2 in cell 1
    const surf2Lens = lenses.find(l => l.range.start.line === doc.surfaces[1].range.startLine);
    expect(surf2Lens).toBeDefined();
    expect(surf2Lens!.command!.title).toMatch(/reference/);
  });

  it('shows reference count for materials', () => {
    // M1 used in cell 1
    const matLens = lenses.find(l => l.range.start.line === doc.materials[0].range.startLine);
    expect(matLens).toBeDefined();
    expect(matLens!.command!.title).toMatch(/reference/);
  });

  it('skips cells with zero references', () => {
    // Cell 2 is not referenced by anything
    const cell2Lens = lenses.find(l => l.range.start.line === doc.cells[1].range.startLine);
    expect(cell2Lens).toBeUndefined();
  });

  it('uses correct singular/plural', () => {
    // Cell 1 has exactly 1 reference (#1 in cell 2)
    const cell1Lens = lenses.find(l => l.range.start.line === doc.cells[0].range.startLine);
    expect(cell1Lens!.command!.title).toBe('1 reference');

    // Surface 1 has 1 reference (-1 in cell 1)
    const surf1Lens = lenses.find(l => l.range.start.line === doc.surfaces[0].range.startLine);
    expect(surf1Lens!.command!.title).toBe('1 reference');

    // Surface 2 has 1 reference (2 in cell 1)
    const surf2Lens = lenses.find(l => l.range.start.line === doc.surfaces[1].range.startLine);
    expect(surf2Lens!.command!.title).toBe('1 reference');

    // M1 has 1 reference (cell 1)
    const matLens = lenses.find(l => l.range.start.line === doc.materials[0].range.startLine);
    expect(matLens!.command!.title).toBe('1 reference');
  });

  it('only shows lens for entity under cursor when cursorLine provided', () => {
    // Cursor on cell 1 (line 1) → only cell 1 lens
    const cell1Line = doc.cells[0].range.startLine;
    const cursorOnCell1 = getCodeLenses(doc, input, uri, { cursorLine: cell1Line });
    expect(cursorOnCell1.length).toBe(1);
    expect(cursorOnCell1[0].range.start.line).toBe(cell1Line);

    // Cursor on surface 1 line → only surface 1 lens
    const surf1Line = doc.surfaces[0].range.startLine;
    const cursorOnSurf1 = getCodeLenses(doc, input, uri, { cursorLine: surf1Line });
    expect(cursorOnSurf1.length).toBe(1);
    expect(cursorOnSurf1[0].range.start.line).toBe(surf1Line);

    // Cursor on material line → only material lens
    const matLine = doc.materials[0].range.startLine;
    const cursorOnMat = getCodeLenses(doc, input, uri, { cursorLine: matLine });
    expect(cursorOnMat.length).toBe(1);
    expect(cursorOnMat[0].range.start.line).toBe(matLine);
  });

  it('shows no lenses when cursor is on a line with no entity', () => {
    // Cursor on blank line between blocks
    const lensesOnBlank = getCodeLenses(doc, input, uri, { cursorLine: 0 });
    expect(lensesOnBlank.length).toBe(0);
  });

  it('uses plural for multiple references', () => {
    const multiInput = `multi ref test
1  1  -2.7  -1 2  IMP:N=1
2  0        #1    IMP:N=0
3  1  -2.7  -1 2  IMP:N=1

1  SO  5.0
2  PX  10.0

M1  13027.80c  1.0
`;
    const multiDoc = parseInputFile(multiInput);
    const multiLenses = getCodeLenses(multiDoc, multiInput, uri);

    // Surface 1 referenced by cell 1 (-1) and cell 3 (-1) = 2 references
    const surf1Lens = multiLenses.find(l => l.range.start.line === multiDoc.surfaces[0].range.startLine);
    expect(surf1Lens!.command!.title).toBe('2 references');

    // M1 referenced by cell 1 and cell 3 = 2 references
    const matLens = multiLenses.find(l => l.range.start.line === multiDoc.materials[0].range.startLine);
    expect(matLens!.command!.title).toBe('2 references');
  });
});
