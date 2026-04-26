import { describe, it, expect } from 'vitest';
import { parseInputFile } from '../../server/src/parser/inputFile';
import { validateCrossReferences } from '../../server/src/analysis/crossReference';

const TEMPLATE_INPUT = `template demo
1 1 -2.7 -1 IMP:N={imp_value}
2 0   1 IMP:N=0

1 SO {radius}

M1 1001.80c 1
NPS {nps_count}
`;

describe('parseInputFile — template placeholder support', () => {
  it('does not crash on {key} placeholders (default true)', () => {
    const doc = parseInputFile(TEMPLATE_INPUT);
    expect(doc.cells.length).toBe(2);
    expect(doc.surfaces.length).toBe(1);
    expect(doc.materials.length).toBe(1);
  });

  it('records 0-based line numbers of templated lines', () => {
    const doc = parseInputFile(TEMPLATE_INPUT);
    // Lines 1 (cell 1), 4 (surface 1), 7 (NPS) are 0-based templated lines.
    expect(new Set(doc.templateLines)).toEqual(new Set([1, 4, 7]));
  });

  it('replaces {key} with 1 so cards parse cleanly', () => {
    const doc = parseInputFile(TEMPLATE_INPUT);
    expect(doc.cells[0].parameters.get('IMP:N')).toBe('1');
    expect(doc.surfaces[0].parameters[0]).toBe(1);
  });

  it('does not record templateLines when ignoreTemplatePlaceholders=false', () => {
    const doc = parseInputFile(TEMPLATE_INPUT, { ignoreTemplatePlaceholders: false });
    expect(doc.templateLines).toBeUndefined();
    // The raw {key} survives in card values when preprocessing is disabled.
    expect(doc.cells[0].parameters.get('IMP:N')).toBe('{imp_value}');
  });

  it('reports an empty templateLines list when input has no braces', () => {
    const doc = parseInputFile(`plain
1 1 -2.7 -1 IMP:N=1
2 0   1 IMP:N=0

1 SO 5

M1 1001.80c 1
NPS 100
`);
    expect(doc.templateLines).toEqual([]);
  });

  it('records a templated line exactly once even with multiple placeholders', () => {
    const doc = parseInputFile(`multi
1 {mat} {rho} -1 IMP:N=1
2 0 1 IMP:N=0

1 SO {radius}

M1 1001.80c 1
`);
    expect(doc.cells[0].materialId).toBe(1);
    expect(doc.templateLines?.filter(l => l === 1).length).toBe(1);
  });
});

describe('template line diagnostic suppression (mirrors server.ts filter)', () => {
  it('drops cross-ref errors on template-affected lines', () => {
    const input = `tally template
1 1 -2.7 -1 IMP:N=1
2 0   1 IMP:N=0

1 SO 5

M1 1001.80c 1
F4:N {target_cell}
NPS 100
`;
    const doc = parseInputFile(input);
    const cross = validateCrossReferences(doc);
    const all = [...doc.parseErrors, ...cross];
    const templateSet = new Set(doc.templateLines ?? []);
    const filtered = all.filter(e => !templateSet.has(e.range.startLine));

    // The F4:N {target_cell} line is line 7 (0-based) — any error here is suppressed.
    expect(filtered.find(e => e.range.startLine === 7)).toBeUndefined();
  });

  it('still surfaces errors on non-templated lines', () => {
    const input = `mix
1 1 -2.7 -999 IMP:N=1
2 0   1 IMP:N=0

1 SO {radius}

M1 1001.80c 1
NPS 100
`;
    const doc = parseInputFile(input);
    const cross = validateCrossReferences(doc);
    const all = [...doc.parseErrors, ...cross];
    const templateSet = new Set(doc.templateLines ?? []);
    const filtered = all.filter(e => !templateSet.has(e.range.startLine));

    // Cell 1 references undefined surface 999 on line 1 — not a template line.
    const errOnCell1 = filtered.find(e => e.range.startLine === 1 && /999/.test(e.message));
    expect(errOnCell1).toBeDefined();
  });
});
