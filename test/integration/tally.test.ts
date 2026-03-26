import { describe, it, expect } from 'vitest';
import { parseInputFile } from '../../server/src/parser/inputFile';

describe('tally card integration', () => {
  it('parses F card and modifier cards from full input', () => {
    const doc = parseInputFile(`tally test
1  1  -2.7  -1  IMP:N=1
2  0  1  IMP:N=0

1  SO  5.0

M1  13027.80c 1.0
F4:N 1
E4 0.1 1 20
FC4 neutron flux in cell 1
`);
    expect(doc.tallyCards).toHaveLength(1);
    expect(doc.tallyCards[0].tallyType).toBe(4);
    expect(doc.tallyCards[0].bins[0].entries[0].id).toBe(1);
    expect(doc.tallyModifiers).toHaveLength(2);
    expect(doc.tallyModifiers.find(m => m.cardType === 'E')).toBeDefined();
    expect(doc.tallyModifiers.find(m => m.cardType === 'FC')).toBeDefined();
  });

  it('parses multiple tallies', () => {
    const doc = parseInputFile(`multi tally
1  1  -1.0  -1  IMP:N=1
2  0  1  IMP:N=0

1  SO  5.0
2  SO  10.0

M1  1001.80c 1.0
F2:N 1 2 T
F4:N 1
E2 0.1 1 20
E4 0.1 1 20
`);
    expect(doc.tallyCards).toHaveLength(2);
    expect(doc.tallyModifiers).toHaveLength(2);
  });
});
