import { describe, it, expect } from 'vitest';
import { getSurfaceHover, getSurfaceTypeHover } from '../../server/src/hover/surfaceHover';
import { parseInputFile } from '../../server/src/parser/inputFile';

describe('getSurfaceHover', () => {
  const doc = parseInputFile(`hover test
1  1  -2.7  -1 2  IMP:N=1
2  0         1  IMP:N=0

1  SO  5.0
2  PX  10.0

M1  13027.80c  1.0
`);

  it('returns hover for SO surface', () => {
    const hover = getSurfaceHover(doc, 1);
    expect(hover).toBeDefined();
    expect(hover).toContain('SO');
    expect(hover).toContain('Sphere');
    expect(hover).toContain('5');
  });

  it('returns hover for PX surface', () => {
    const hover = getSurfaceHover(doc, 2);
    expect(hover).toContain('PX');
    expect(hover).toContain('Plane');
    expect(hover).toContain('10');
  });

  it('returns undefined for nonexistent surface', () => {
    expect(getSurfaceHover(doc, 99)).toBeUndefined();
  });

  it('shows modifier for reflecting surface', () => {
    const doc2 = parseInputFile(`reflect test
1  0  -1

*1  PX  0.0

NPS 1
`);
    const hover = getSurfaceHover(doc2, 1);
    expect(hover).toContain('reflecting');
  });

  it('shows transform info', () => {
    const doc2 = parseInputFile(`transform test
1  0  -1

1  5  CX  1.0

NPS 1
`);
    const hover = getSurfaceHover(doc2, 1);
    expect(hover).toContain('TR5');
  });
});

describe('getSurfaceTypeHover', () => {
  it('shows usage for CZ', () => {
    const hover = getSurfaceTypeHover('CZ');
    expect(hover).toBeDefined();
    expect(hover).toContain('**CZ**');
    expect(hover).toContain('Cylinder on z axis');
    expect(hover).toContain('`j CZ R`');
  });

  it('is case-insensitive', () => {
    const hover = getSurfaceTypeHover('cz');
    expect(hover).toBeDefined();
    expect(hover).toContain('**CZ**');
  });

  it('shows variable param counts for K/X', () => {
    const hover = getSurfaceTypeHover('K/X');
    expect(hover).toBeDefined();
    expect(hover).toContain('4 or 5 parameters');
  });

  it('shows all params for RPP', () => {
    const hover = getSurfaceTypeHover('RPP');
    expect(hover).toBeDefined();
    expect(hover).toContain('xmin');
    expect(hover).toContain('xmax');
    expect(hover).toContain('zmax');
  });

  it('shows equation', () => {
    const hover = getSurfaceTypeHover('SO');
    expect(hover).toBeDefined();
    expect(hover).toContain('R\u00B2');
  });

  it('returns undefined for unknown mnemonic', () => {
    expect(getSurfaceTypeHover('FAKE')).toBeUndefined();
  });

  it('includes ASCII art when enabled', () => {
    const hover = getSurfaceTypeHover('RPP', true);
    expect(hover).toBeDefined();
    expect(hover).toContain('```');
    expect(hover).toContain('+----------+');
  });

  it('does not include ASCII art when disabled', () => {
    const hover = getSurfaceTypeHover('RPP', false);
    expect(hover).toBeDefined();
    expect(hover).not.toContain('```');
  });

  it('does not include ASCII art by default', () => {
    const hover = getSurfaceTypeHover('RPP');
    expect(hover).toBeDefined();
    expect(hover).not.toContain('```');
  });

  it('shows art for BOX', () => {
    const hover = getSurfaceTypeHover('BOX', true);
    expect(hover).toContain('```');
    expect(hover).toContain('A1');
    expect(hover).toContain('A2');
    expect(hover).toContain('A3');
  });

  it('no art for non-box types', () => {
    for (const t of ['CZ', 'SO', 'GQ', 'TRC', 'RCC']) {
      const hover = getSurfaceTypeHover(t, true);
      expect(hover).toBeDefined();
      expect(hover).not.toContain('```');
    }
  });
});

describe('getSurfaceHover — ASCII art', () => {
  const doc = parseInputFile(`art test
1  0  -1  IMP:N=1

1  RPP  0 10 0 10 0 10

NPS 1
`);

  it('includes art for RPP when asciiSurfaceArt is true', () => {
    const hover = getSurfaceHover(doc, 1, { asciiSurfaceArt: true });
    expect(hover).toBeDefined();
    expect(hover).toContain('```');
    expect(hover).toContain('+----------+');
  });

  it('no art when asciiSurfaceArt is false', () => {
    const hover = getSurfaceHover(doc, 1, { asciiSurfaceArt: false });
    expect(hover).toBeDefined();
    expect(hover).not.toContain('```');
  });

  it('no art for non-box surface type', () => {
    const doc2 = parseInputFile(`no art
1  0  -1  IMP:N=1

1  SO  5.0

NPS 1
`);
    const hover = getSurfaceHover(doc2, 1, { asciiSurfaceArt: true });
    expect(hover).toBeDefined();
    expect(hover).not.toContain('```');
  });
});
