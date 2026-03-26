import { describe, it, expect } from 'vitest';
import { parseInputFile } from '../../server/src/parser/inputFile';

describe('check 65: unrecognized data card detection', () => {
  it('flags a completely unknown card name', () => {
    const doc = parseInputFile(`unrecognized card test
1 0 -1 IMP:N=0

1 SO 5.0

FOOBAR 1 2 3
NPS 1000
`);
    const err = doc.parseErrors.find(e => e.checkNumber === 65);
    expect(err).toBeDefined();
    expect(err!.message).toContain('FOOBAR');
    expect(err!.severity).toBe('warning');
  });

  it('suggests close match for typo', () => {
    const doc = parseInputFile(`typo card test
1 0 -1 IMP:N=0

1 SO 5.0

SRDEF ERG=1.0
NPS 1000
`);
    const err = doc.parseErrors.find(e => e.checkNumber === 65);
    expect(err).toBeDefined();
    expect(err!.message).toContain('SRDEF');
    expect(err!.message).toContain("did you mean 'SDEF'");
  });

  it('silently skips known-but-unparsed cards', () => {
    const doc = parseInputFile(`known unparsed test
1 0 -1 IMP:N=0

1 SO 5.0

PHYS:N 100 0
CUT:N 1e30
PRINT
RAND GEN=2
NPS 1000
`);
    const check65 = doc.parseErrors.filter(e => e.checkNumber === 65);
    expect(check65).toHaveLength(0);
  });

  it('silently skips all recognized card types', () => {
    const doc = parseInputFile(`all recognized
1 1 -2.7 -1 IMP:N=1
2 0        1 IMP:N=0

1 SO 5.0

M1 13027.80c 1.0
SDEF ERG=1.0
MODE N
NPS 1000
`);
    const check65 = doc.parseErrors.filter(e => e.checkNumber === 65);
    expect(check65).toHaveLength(0);
  });

  it('suggests KCODE for KODE typo', () => {
    const doc = parseInputFile(`kcode typo
1 0 -1 IMP:N=0

1 SO 5.0

KODE 1000 1.0 10 100
`);
    const err = doc.parseErrors.find(e => e.checkNumber === 65);
    expect(err).toBeDefined();
    expect(err!.message).toContain("did you mean 'KCODE'");
  });

  it('no suggestion for distant mismatch', () => {
    const doc = parseInputFile(`distant mismatch
1 0 -1 IMP:N=0

1 SO 5.0

XYZZY 1 2 3
NPS 1000
`);
    const err = doc.parseErrors.find(e => e.checkNumber === 65);
    expect(err).toBeDefined();
    expect(err!.message).not.toContain('did you mean');
  });
});
