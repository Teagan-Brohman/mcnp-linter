import { describe, it, expect } from 'vitest';
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
    // Surface 3 gets treated as data. Warn about this.
    const result = tokenizeInput(input);
    expect(result.warnings.length).toBeGreaterThan(0);
    const splitWarning = result.warnings.find(w => w.message.includes('unexpected'));
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
