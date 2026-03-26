import { describe, it, expect } from 'vitest';
import { getDocumentLinks } from '../../server/src/links/documentLinksProvider';
import { parseInputFile } from '../../server/src/parser/inputFile';

describe('getDocumentLinks', () => {
  it('creates link for READ FILE=cells.i card', () => {
    const text = `title
1  0  -1  IMP:N=1

1  SO 5

READ FILE=cells.i
`;
    const doc = parseInputFile(text);
    const links = getDocumentLinks(doc, text, 'file:///home/user/project/input.mcnp');

    expect(links).toHaveLength(1);
    const link = links[0];
    // Range should span "cells.i"
    expect(link.range.start.line).toBe(5);
    expect(link.range.start.character).toBe(10);
    expect(link.range.end.character).toBe(17);
    expect(link.target).toBe('file:///home/user/project/cells.i');
  });

  it('returns empty when no READ cards', () => {
    const text = `title
1  0  -1  IMP:N=1

1  SO 5

NPS 100
`;
    const doc = parseInputFile(text);
    const links = getDocumentLinks(doc, text, 'file:///home/user/project/input.mcnp');

    expect(links).toHaveLength(0);
  });

  it('resolves path relative to base URI', () => {
    const text = `title
1  0  -1  IMP:N=1

1  SO 5

READ FILE=sub/geometry.i
`;
    const doc = parseInputFile(text);
    const links = getDocumentLinks(doc, text, 'file:///data/mcnp/run/deck.i');

    expect(links).toHaveLength(1);
    expect(links[0].target).toBe('file:///data/mcnp/run/sub/geometry.i');
    // Check filename range covers "sub/geometry.i"
    expect(links[0].range.start.character).toBe(10);
    expect(links[0].range.end.character).toBe(24);
  });
});
