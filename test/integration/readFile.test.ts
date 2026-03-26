import { describe, it, expect } from 'vitest';
import { parseInputFile } from '../../server/src/parser/inputFile';

describe('READ card file resolution', () => {
  it('parses READ card and extracts filename', () => {
    const doc = parseInputFile(`test read
1  0  -1  IMP:N=0

1  SO  5.0

READ FILE=extra.i
NPS 1000
`);
    expect(doc.readCards).toHaveLength(1);
    expect(doc.readCards[0].filename).toBe('extra.i');
  });
});
