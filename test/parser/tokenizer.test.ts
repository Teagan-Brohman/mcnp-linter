import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { tokenizeInput } from '../../server/src/parser/tokenizer';

describe('tokenizer', () => {
  it('identifies three blocks separated by blank lines', () => {
    const input = `title line
1  1 -2.7  -1  IMP:N=1
2  0        1  IMP:N=0

1  SO  5.0

M1  13027.80c  1.0
NPS  1000
`;
    const result = tokenizeInput(input);
    expect(result.title).toBe('title line');
    expect(result.cellLines.length).toBe(2);
    expect(result.surfaceLines.length).toBe(1);
    expect(result.dataLines.length).toBe(2);
  });

  it('strips c-style comment lines', () => {
    const input = `title
c this is a comment
1  0  -1  IMP:N=1

1  SO 5

M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    expect(result.cellLines.length).toBe(1);
    expect(result.cellLines[0].text).not.toContain('comment');
  });

  it('strips dollar-sign inline comments', () => {
    const input = `title
1  0  -1  IMP:N=1  $ my cell

1  SO 5

M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    expect(result.cellLines[0].text).not.toContain('my cell');
    expect(result.cellLines[0].text).toContain('IMP:N=1');
  });

  it('joins continuation lines (5-blank-column indent)', () => {
    const input = `title
1  1 -2.7
     -1 -2 3  IMP:N=1

1  SO 5

M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    expect(result.cellLines.length).toBe(1);
    expect(result.cellLines[0].text).toContain('-1');
    expect(result.cellLines[0].text).toContain('-2');
  });

  it('joins continuation lines (ampersand)', () => {
    const input = `title
1  1 -2.7 &
-1 -2 3  IMP:N=1

1  SO 5

M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    expect(result.cellLines.length).toBe(1);
    expect(result.cellLines[0].text).toContain('-2.7');
    expect(result.cellLines[0].text).toContain('-1');
  });

  it('handles message block', () => {
    const input = `message: o=test.o

title line
1  0  -1

1  SO 5

M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    expect(result.messageBlock).toContain('message');
    expect(result.title).toBe('title line');
  });

  it('preserves startLine and endLine for logical lines', () => {
    const input = `title
1  1 -2.7
     -1  IMP:N=1

1  SO 5

M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    expect(result.cellLines[0].startLine).toBe(1);
    expect(result.cellLines[0].endLine).toBe(2);
  });

  it('handles multiple continuation lines', () => {
    const input = `title
M1 1001.80c 0.6667
     8016.80c 0.3333
     NLIB=80c

1  SO 5

1  0  -1
`;
    // Note: this has cells and surfaces swapped from normal, but
    // tokenizer doesn't validate content, just splits on blank lines
    const result = tokenizeInput(input);
    expect(result.cellLines.length).toBe(1);
    expect(result.cellLines[0].text).toContain('8016');
    expect(result.cellLines[0].text).toContain('NLIB');
  });

  it('populates originalLineNumbers for continuation lines', () => {
    const input = `title
1  1 -2.7
     -1 -2 3  IMP:N=1

1  SO 5

M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    const cell = result.cellLines[0];
    expect(cell.originalLineNumbers).toBeDefined();
    expect(cell.originalLineNumbers).toEqual([1, 2]);
  });

  it('handles extra blank lines between blocks gracefully', () => {
    const input = `title
1  0  -1  IMP:N=1


1  SO 5

M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    // Should still parse correctly despite double blank line
    expect(result.cellLines.length).toBe(1);
    expect(result.surfaceLines.length).toBe(1);
    expect(result.dataLines.length).toBe(1);
  });

  it('returns warnings for extra blank lines between blocks', () => {
    const input = `title
1  0  -1  IMP:N=1


1  SO 5

M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].message).toContain('blank line');
  });

  it('returns warning when blank line splits a block (more than 3 blocks)', () => {
    const input = `title
1  0  -1  IMP:N=1
2  0   1  IMP:N=0

1  SO 5
2  PX 10

3  CZ 3

M1 1001.80c 1
`;
    // The blank line between surfaces "2 PX 10" and "3 CZ 3" creates 4 blocks.
    // Issue #7 detection: both sides of the stray separator look like surfaces,
    // so we flag it specifically as a surface-block split.
    const result = tokenizeInput(input);
    expect(result.warnings.length).toBeGreaterThan(0);
    const splitWarning = result.warnings.find(w => /Stray blank line.*surface/.test(w.message));
    expect(splitWarning).toBeDefined();
  });

  it('no warnings for correctly formatted input', () => {
    const input = `title
1  0  -1  IMP:N=1

1  SO 5

M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    expect(result.warnings).toEqual([]);
  });

  it('handles CRLF line endings identically to LF', () => {
    const lfInput = `title line\n1  0  -1  IMP:N=1\n\n1  SO  5.0\n\nM1  1001.80c  1.0\n`;
    const crlfInput = lfInput.replace(/\n/g, '\r\n');
    const lfResult = tokenizeInput(lfInput);
    const crlfResult = tokenizeInput(crlfInput);
    expect(crlfResult.title).toBe(lfResult.title);
    expect(crlfResult.cellLines.length).toBe(lfResult.cellLines.length);
    expect(crlfResult.surfaceLines.length).toBe(lfResult.surfaceLines.length);
    expect(crlfResult.dataLines.length).toBe(lfResult.dataLines.length);
    expect(crlfResult.cellLines[0].text).toBe(lfResult.cellLines[0].text);
  });
});

describe('tokenizer — tab handling in continuation detection', () => {
  it('treats a single leading tab as a continuation (tab expands past col 5)', () => {
    const input = `title
1  1 -2.7
\t-1 -2 3  IMP:N=1

1  SO 5

M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    expect(result.cellLines.length).toBe(1);
    expect(result.cellLines[0].text).toContain('-1');
    expect(result.cellLines[0].text).toContain('-2');
  });

  it('treats spaces+tab whose tab stop reaches col 6+ as a continuation', () => {
    // 3 spaces + tab → tab advances col 3 to col 8 → first non-blank at col 9
    const input = `title
1  1 -2.7
   \t-1 -2 3  IMP:N=1

1  SO 5

M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    expect(result.cellLines.length).toBe(1);
    expect(result.cellLines[0].text).toContain('-1');
  });

  it('joins a tab-prefixed line as continuation of the prior card', () => {
    const input = `title
1  1 -2.7  -1 -2 3  IMP:N=1
\tVOL=1.5

1  SO 5

M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    expect(result.cellLines.length).toBe(1);
    expect(result.cellLines[0].text).toContain('VOL=1.5');
  });

  it('rejects 4 spaces (no tab) as a continuation — only 4 blank columns', () => {
    const input = `title
1  1 -2.7
    -1 -2 3  IMP:N=1

1  SO 5

M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    // 4 leading spaces is NOT enough — should be 2 separate logical cell lines
    expect(result.cellLines.length).toBe(2);
  });

  it('handles the u-zr4.inp tab-continuation pattern', () => {
    const input = `title
482 0 (-400 500):(-401 501):(-402 502)
\t:(-410 510):(-411 511):(-412 512) IMP:N=1

1 SO 5

M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    expect(result.cellLines.length).toBe(1);
    expect(result.cellLines[0].text).toContain('-410');
    expect(result.cellLines[0].text).toContain('-412');
  });

  it('parses u-zr4.inp without splitting tab-continued cell 482', () => {
    const path = join(__dirname, '..', '..', 'realWorldTestFiles', 'u-zr4.inp');
    const input = readFileSync(path, 'utf8');
    const result = tokenizeInput(input);

    // Cell 482 spans 4 physical lines (148-151 in source) joined by tab continuations.
    const cell482 = result.cellLines.find(l => l.text.trim().startsWith('482 '));
    expect(cell482).toBeDefined();
    expect(cell482!.text).toContain('-435 535'); // last surface union from line 151
    expect(cell482!.text).toContain('-410 510'); // from line 149
    expect(cell482!.text).toContain('-420 520'); // from line 150
  });
});

describe('tokenizer — uncommented continuation in commented block (issue #2)', () => {
  it('warns when a continuation line is sandwiched between two comments', () => {
    const input = `title
1  1 -2.7  -1  IMP:N=1

1  SO 5

c M9599 5010.00c 0.014236
c      24050.00c 0.008284
      26054.00c 0.037078
c         26058.00c 0.001789
c      28058.00c 0.057490
M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    const warn = result.warnings.find(w => /uncommented/i.test(w.message));
    expect(warn).toBeDefined();
    expect(warn!.severity ?? 'warning').toBe('warning');
  });

  it('does NOT warn for a normal continuation surrounded by card content', () => {
    const input = `title
1  1 -2.7  -1  IMP:N=1
   VOL=1.5
2  0   1  IMP:N=0

1  SO 5

M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    expect(result.warnings.find(w => /uncommented/i.test(w.message))).toBeUndefined();
  });

  it('does NOT warn for a continuation with a comment only above', () => {
    const input = `title
1  1 -2.7  -1  IMP:N=1
c some explanation
   VOL=1.5
2  0   1  IMP:N=0

1  SO 5

M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    expect(result.warnings.find(w => /uncommented/i.test(w.message))).toBeUndefined();
  });

  it('does NOT warn for a continuation with a comment only below', () => {
    const input = `title
1  1 -2.7  -1  IMP:N=1
   VOL=1.5
c trailing comment
2  0   1  IMP:N=0

1  SO 5

M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    expect(result.warnings.find(w => /uncommented/i.test(w.message))).toBeUndefined();
  });

  it('warns once per offending line in a deeply commented block', () => {
    const input = `title
1  1 -2.7  -1  IMP:N=1

1  SO 5

c M1 1001.80c 1
c      2003.10c 2
       8016.10c 3
c      3007.10c 4
       4009.10c 5
c      5010.10c 6
M2 1001.80c 1
`;
    const result = tokenizeInput(input);
    const warns = result.warnings.filter(w => /uncommented/i.test(w.message));
    expect(warns.length).toBe(2);
  });

  it('does NOT warn at the top of a block where there is no preceding comment', () => {
    const input = `title
   VOL=1.5
1  1 -2.7  -1  IMP:N=1

1  SO 5

M1 1001.80c 1
`;
    const result = tokenizeInput(input);
    expect(result.warnings.find(w => /uncommented/i.test(w.message))).toBeUndefined();
  });
});

describe('tokenizer — stray-separator detection (issue #7)', () => {
  it('flags a stray separator inside the data block as data|data', () => {
    const input = `title
1 0 -1 IMP:N=1
2 0 1 IMP:N=0

1 SO 5

M1 1001.80c 1

NPS 100
`;
    const result = tokenizeInput(input);
    const stray = result.warnings.find(w => /Stray blank line/.test(w.message));
    expect(stray).toBeDefined();
    expect(stray!.message).toContain('data');
    expect(stray!.severity).toBe('error');
  });

  it('flags a stray separator inside the cell block as cell|cell', () => {
    const input = `title
1 0 -1 IMP:N=1

2 0 1 IMP:N=0

1 SO 5

M1 1001.80c 1
NPS 100
`;
    const result = tokenizeInput(input);
    const strays = result.warnings.filter(w => /Stray blank line/.test(w.message) && w.message.includes('cell'));
    expect(strays.length).toBe(1);
  });

  it('does not flag a normal cell-surface-data structure', () => {
    const input = `title
1 0 -1 IMP:N=1
2 0 1 IMP:N=0

1 SO 5

M1 1001.80c 1
NPS 100
`;
    const result = tokenizeInput(input);
    expect(result.warnings.find(w => /Stray blank line/.test(w.message))).toBeUndefined();
  });

  it('flags multiple stray separators independently', () => {
    const input = `title
1 0 -1 IMP:N=1
2 0 1 IMP:N=0

1 SO 5

M1 1001.80c 1

M2 8016.80c 1

NPS 100
`;
    const result = tokenizeInput(input);
    const strays = result.warnings.filter(w => /Stray blank line/.test(w.message));
    expect(strays.length).toBe(2);
  });
});
