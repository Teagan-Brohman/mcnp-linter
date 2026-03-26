import { describe, it, expect } from 'vitest';
import { getCodeActions } from '../../server/src/codeActions/codeActionProvider';
import { parseInputFile } from '../../server/src/parser/inputFile';
import { CodeActionKind, Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';

const inputText = `code action test
1  5  -2.7  -1  IMP:N=1
2  0         1  IMP:N=0

1  SO  5.0

NPS 1000
`;

function makeDiag(message: string): Diagnostic {
  return {
    range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
    severity: DiagnosticSeverity.Error,
    source: 'mcnp-linter',
    message,
  };
}

function makeDiagAtRange(
  message: string,
  range: { start: { line: number; character: number }; end: { line: number; character: number } },
  severity: DiagnosticSeverity = DiagnosticSeverity.Error
): Diagnostic {
  return { range, severity, source: 'mcnp-linter', message };
}

describe('getCodeActions', () => {
  const doc = parseInputFile(inputText);

  it('creates material stub for "Material N referenced" diagnostic', () => {
    const diags = [makeDiag('Material 5 referenced in cell 1 is not defined')];
    const actions = getCodeActions(doc, diags, inputText, 'file:///test.mcnp');
    expect(actions.length).toBe(1);
    expect(actions[0].title).toBe('Create material M5');
    const edit = actions[0].edit?.changes?.['file:///test.mcnp']?.[0];
    expect(edit).toBeDefined();
    expect(edit!.newText).toContain('M5');
    expect(edit!.newText).toContain('TODO');
  });

  it('creates material stub for MT references diagnostic', () => {
    const diags = [makeDiag('MT 3 references material M3 which is not defined')];
    const actions = getCodeActions(doc, diags, inputText, 'file:///test.mcnp');
    expect(actions.length).toBe(1);
    expect(actions[0].title).toBe('Create material M3');
  });

  it('deduplicates material IDs', () => {
    const diags = [
      makeDiag('Material 5 referenced in cell 1 is not defined'),
      makeDiag('Material 5 referenced in cell 2 is not defined'),
    ];
    const actions = getCodeActions(doc, diags, inputText, 'file:///test.mcnp');
    expect(actions.length).toBe(1);
  });

  it('returns empty for unrelated diagnostics', () => {
    const diags = [makeDiag('Some other error')];
    const actions = getCodeActions(doc, diags, inputText, 'file:///test.mcnp');
    expect(actions.length).toBe(0);
  });

  it('insert location is after surface block when no parsed data cards', () => {
    const actions = getCodeActions(doc, [makeDiag('Material 5 referenced in cell 1 is not defined')], inputText, 'file:///test.mcnp');
    expect(actions.length).toBe(1);
    const edit = actions[0].edit!;
    const changes = edit.changes!['file:///test.mcnp'];
    expect(changes.length).toBe(1);
    // NPS is now a recognized data card on line 6, so insert at line 7
    expect(changes[0].range.start.line).toBe(7);
  });

  it('insert location is after last parsed data card when data cards exist', () => {
    const textWithMat = `code action with mat
1  1  -2.7  -1  IMP:N=1

1  SO  5.0

M1  1001.80c  1.0
NPS 1000
`;
    const docWithMat = parseInputFile(textWithMat);
    const diags = [makeDiag('Material 5 referenced in cell 1 is not defined')];
    const actions = getCodeActions(docWithMat, diags, textWithMat, 'file:///test.mcnp');
    const changes = actions[0].edit!.changes!['file:///test.mcnp'];
    // NPS on line 6 is now a recognized data card, so insert at line 7
    expect(changes[0].range.start.line).toBe(7);
  });

  it('creates cell stub for missing cell complement', () => {
    const diags = [makeDiag('Cell 99 referenced by complement #99 in cell 1 is not defined')];
    const actions = getCodeActions(doc, diags, inputText, 'file:///test.mcnp');
    expect(actions.length).toBe(1);
    expect(actions[0].title).toBe('Create cell 99');
    const changes = actions[0].edit!.changes!['file:///test.mcnp'];
    expect(changes[0].newText).toBe('99  0  imp:n=0  $ TODO: define cell 99\n');
    // Insert after last cell endLine
    const cellEndLine = doc.cells.reduce((max, c) => Math.max(max, c.range.endLine), -1);
    expect(changes[0].range.start.line).toBe(cellEndLine + 1);
  });

  it('creates cell stub for missing cell in tally', () => {
    const diags = [makeDiag('Cell 10 referenced in F4 tally does not exist')];
    const actions = getCodeActions(doc, diags, inputText, 'file:///test.mcnp');
    expect(actions.length).toBe(1);
    expect(actions[0].title).toBe('Create cell 10');
  });

  it('creates cell stub for CF reference', () => {
    const diags = [makeDiag('CF4 references cell 7 which does not exist')];
    const actions = getCodeActions(doc, diags, inputText, 'file:///test.mcnp');
    expect(actions.length).toBe(1);
    expect(actions[0].title).toBe('Create cell 7');
  });

  it('creates cell stub for LIKE BUT reference', () => {
    const diags = [makeDiag('Cell 3 uses LIKE 5 BUT — cell 5 is not defined')];
    const actions = getCodeActions(doc, diags, inputText, 'file:///test.mcnp');
    expect(actions.length).toBe(1);
    expect(actions[0].title).toBe('Create cell 5');
  });

  it('creates surface stub for missing surface reference', () => {
    const diags = [makeDiag('Surface 42 referenced in cell 1 is not defined')];
    const actions = getCodeActions(doc, diags, inputText, 'file:///test.mcnp');
    expect(actions.length).toBe(1);
    expect(actions[0].title).toBe('Create surface 42');
    const changes = actions[0].edit!.changes!['file:///test.mcnp'];
    expect(changes[0].newText).toBe('42  SO  1.0  $ TODO: define surface 42\n');
    // Insert after last surface endLine
    const surfEndLine = doc.surfaces.reduce((max, s) => Math.max(max, s.range.endLine), -1);
    expect(changes[0].range.start.line).toBe(surfEndLine + 1);
  });

  it('creates surface stub for tally surface reference', () => {
    const diags = [makeDiag('Surface 5 referenced in F2 tally does not exist')];
    const actions = getCodeActions(doc, diags, inputText, 'file:///test.mcnp');
    expect(actions.length).toBe(1);
    expect(actions[0].title).toBe('Create surface 5');
  });

  it('creates surface stub for FS/SF reference', () => {
    const diags = [makeDiag('FS4 references surface 10 which does not exist')];
    const actions = getCodeActions(doc, diags, inputText, 'file:///test.mcnp');
    expect(actions.length).toBe(1);
    expect(actions[0].title).toBe('Create surface 10');
  });

  it('handles multiple entity types in same diagnostic set', () => {
    const diags = [
      makeDiag('Material 5 referenced in cell 1 is not defined'),
      makeDiag('Cell 99 referenced by complement #99 in cell 1 is not defined'),
      makeDiag('Surface 42 referenced in cell 1 is not defined'),
    ];
    const actions = getCodeActions(doc, diags, inputText, 'file:///test.mcnp');
    expect(actions.length).toBe(3);
    const titles = actions.map(a => a.title);
    expect(titles).toContain('Create material M5');
    expect(titles).toContain('Create cell 99');
    expect(titles).toContain('Create surface 42');
  });

  it('deduplicates across entity types independently', () => {
    const diags = [
      makeDiag('Cell 5 referenced in F4 tally does not exist'),
      makeDiag('Cell 5 referenced in F14 tally does not exist'),
      makeDiag('Surface 5 referenced in F2 tally does not exist'),
      makeDiag('Surface 5 referenced in F12 tally does not exist'),
    ];
    const actions = getCodeActions(doc, diags, inputText, 'file:///test.mcnp');
    expect(actions.length).toBe(2);
    const titles = actions.map(a => a.title);
    expect(titles).toContain('Create cell 5');
    expect(titles).toContain('Create surface 5');
  });

  it('offers NPS stub for check 41', () => {
    const text = `code action test\n1 0 -1 IMP:N=1\n2 0  1 IMP:N=0\n\n1 SO 5.0\n\nSDEF ERG=1.0\n`;
    const doc41 = parseInputFile(text);
    const diags: Diagnostic[] = [{
      message: 'No NPS or CTME card found — problem has no termination condition',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      severity: DiagnosticSeverity.Warning,
    }];
    const actions = getCodeActions(doc41, diags, text, 'file:///test');
    const nps = actions.find(a => a.title.includes('NPS'));
    expect(nps).toBeDefined();
    const edit = nps!.edit?.changes?.['file:///test']?.[0];
    expect(edit).toBeDefined();
    expect(edit!.newText).toBe('NPS 1000\n');
  });

  it('offers SDEF stub for check 47', () => {
    const text = `code action test\n1 0 -1 IMP:N=1\n2 0  1 IMP:N=0\n\n1 SO 5.0\n\nNPS 1000\n`;
    const doc47 = parseInputFile(text);
    const diags: Diagnostic[] = [{
      message: 'No SDEF or KCODE card found — problem has no source definition',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      severity: DiagnosticSeverity.Warning,
    }];
    const actions = getCodeActions(doc47, diags, text, 'file:///test');
    const sdef = actions.find(a => a.title.includes('SDEF'));
    expect(sdef).toBeDefined();
  });

  it('offers TR stub for check 39', () => {
    const text = `code action test\n1 0 -1 IMP:N=1\n2 0  1 IMP:N=0\n\n5 1 SO 5.0\n\nNPS 1000\nSDEF ERG=1.0\n`;
    const doc39 = parseInputFile(text);
    const diags: Diagnostic[] = [{
      message: 'Surface 1 references TR5 which is not defined',
      range: { start: { line: 4, character: 0 }, end: { line: 4, character: 10 } },
      severity: DiagnosticSeverity.Warning,
    }];
    const actions = getCodeActions(doc39, diags, text, 'file:///test');
    const tr = actions.find(a => a.title.includes('TR5'));
    expect(tr).toBeDefined();
  });

  describe('elemental ZAID expansion', () => {
    it('expands elemental ZAID with weight fraction', () => {
      const text = `expand test
1  1  -2.7  -1  IMP:N=1
2  0         1  IMP:N=0

1  SO  5.0

M1  6000 -0.13
    8016.80c -0.87
`;
      const doc = parseInputFile(text);
      const diag = makeDiagAtRange(
        'Elemental ZAID 6000 — not supported by ENDF/B-VIII+ libraries; expand to isotopic form',
        { start: { line: 6, character: 4 }, end: { line: 6, character: 8 } },
        DiagnosticSeverity.Information
      );
      const actions = getCodeActions(doc, [diag], text, 'file:///test.mcnp');
      const expand = actions.find(a => a.title.includes('Expand'));
      expect(expand).toBeDefined();
      const edits = expand!.edit!.changes!['file:///test.mcnp'];
      expect(edits.length).toBe(1);
      // Should replace the "6000 -0.13" with expanded isotopes
      const newText = edits[0].newText;
      expect(newText).toContain('6012');
      expect(newText).toContain('6013');
    });

    it('carries suffix to expanded isotopes', () => {
      const text = `suffix test
1  1  -2.7  -1  IMP:N=1
2  0         1  IMP:N=0

1  SO  5.0

M1  6000.70c -0.13
    8016.70c -0.87
`;
      const doc = parseInputFile(text);
      const diag = makeDiagAtRange(
        'ZAID 6000.70c not found in xsdir',
        { start: { line: 6, character: 4 }, end: { line: 6, character: 12 } },
        DiagnosticSeverity.Warning
      );
      const actions = getCodeActions(doc, [diag], text, 'file:///test.mcnp');
      const expand = actions.find(a => a.title.includes('Expand'));
      expect(expand).toBeDefined();
      const newText = expand!.edit!.changes!['file:///test.mcnp'][0].newText;
      expect(newText).toContain('6012.70c');
      expect(newText).toContain('6013.70c');
    });

    it('uses atom fractions for positive fraction', () => {
      const text = `atom test
1  1  -2.7  -1  IMP:N=1
2  0         1  IMP:N=0

1  SO  5.0

M1  6000 0.5
    8016 0.5
`;
      const doc = parseInputFile(text);
      const diag = makeDiagAtRange(
        'Elemental ZAID 6000 — not supported by ENDF/B-VIII+ libraries; expand to isotopic form',
        { start: { line: 6, character: 4 }, end: { line: 6, character: 8 } },
        DiagnosticSeverity.Information
      );
      const actions = getCodeActions(doc, [diag], text, 'file:///test.mcnp');
      const expand = actions.find(a => a.title.includes('Expand'));
      expect(expand).toBeDefined();
      const newText = expand!.edit!.changes!['file:///test.mcnp'][0].newText;
      expect(newText).toContain('6012');
      expect(newText).toContain('6013');
      // Atom fractions: should be positive
      expect(newText).not.toContain('-');
    });

    it('handles monoisotopic element (Al)', () => {
      const text = `mono test
1  1  -2.7  -1  IMP:N=1
2  0         1  IMP:N=0

1  SO  5.0

M1  13000 -1.0
`;
      const doc = parseInputFile(text);
      const diag = makeDiagAtRange(
        'Elemental ZAID 13000 — not supported by ENDF/B-VIII+ libraries; expand to isotopic form',
        { start: { line: 6, character: 4 }, end: { line: 6, character: 9 } },
        DiagnosticSeverity.Information
      );
      const actions = getCodeActions(doc, [diag], text, 'file:///test.mcnp');
      const expand = actions.find(a => a.title.includes('Expand'));
      expect(expand).toBeDefined();
      const newText = expand!.edit!.changes!['file:///test.mcnp'][0].newText;
      expect(newText).toContain('13027');
      expect(newText).toContain('-1.00000'); // 6 sig figs
      expect(newText).not.toContain('-1.000000'); // not 7 sig figs
      expect(newText).not.toContain('13000');
    });
  });

  it('offers quick fix on elemental ZAID at cursor without diagnostic', () => {
    const text = `refactor test
1  1  -2.7  -1  IMP:N=1
2  0         1  IMP:N=0

1  SO  5.0

M1  6000 -0.13
    8016.80c -0.87
NPS 1000
`;
    const doc = parseInputFile(text);
    const range = { start: { line: 6, character: 5 }, end: { line: 6, character: 5 } };
    const actions = getCodeActions(doc, [], text, 'file:///test.mcnp', range);
    const quickfix = actions.find(a => a.kind === CodeActionKind.Refactor && a.title.includes('Expand'));
    expect(quickfix).toBeDefined();
  });

  it('no refactor action on isotopic ZAID', () => {
    const text = `no refactor test
1  1  -2.7  -1  IMP:N=1
2  0         1  IMP:N=0

1  SO  5.0

M1  6012.80c -0.13
NPS 1000
`;
    const doc = parseInputFile(text);
    const range = { start: { line: 6, character: 5 }, end: { line: 6, character: 5 } };
    const actions = getCodeActions(doc, [], text, 'file:///test.mcnp', range);
    const refactor = actions.find(a => a.kind === CodeActionKind.Refactor);
    expect(refactor).toBeUndefined();
  });

  it('offers IMP fix for check 49', () => {
    const text = `code action test\n1 1 -2.7 -1 IMP:N=1\n2 0       1 IMP:N=0\n\n1 SO 5.0\n\nM1 13027.80c 1.0\nMODE N P\nSDEF ERG=1.0\nNPS 1000\n`;
    const doc49 = parseInputFile(text);
    const diags: Diagnostic[] = [{
      message: 'Cell 1 has no IMP:P — importance required for each particle in MODE (N,P)',
      range: { start: { line: 1, character: 0 }, end: { line: 1, character: 20 } },
      severity: DiagnosticSeverity.Warning,
    }];
    const actions = getCodeActions(doc49, diags, text, 'file:///test');
    const imp = actions.find(a => a.title.includes('IMP:P'));
    expect(imp).toBeDefined();
  });
});
