import { McnpDocument, SourceRange } from '../types';
import { DocumentIndex } from '../analysis/documentIndex';
import { getEntityAtPosition, getTokenRange, findModifierTokenPositions } from '../analysis/lspUtils';
import { splitLines } from '../utils/text';
import { SURFACE_TALLY_TYPES, CELL_TALLY_TYPES } from '../data/tallyTypes';

export function findReferences(
  doc: McnpDocument,
  position: { line: number; character: number },
  text: string,
  options: { idx?: DocumentIndex; includeDeclaration?: boolean } = {}
): SourceRange[] {
  const idx = options.idx ?? new DocumentIndex(doc);
  const entity = getEntityAtPosition(doc, position, text, idx);
  if (!entity) return [];

  const includeDecl = options.includeDeclaration ?? true;
  const lines = splitLines(text);

  switch (entity.type) {
    case 'cell': return findCellReferences(doc, entity.id, lines, idx, includeDecl);
    case 'surface': return findSurfaceReferences(doc, entity.id, lines, idx, includeDecl);
    case 'material': return findMaterialReferences(doc, entity.id, lines, idx, includeDecl);
    default: { const _: never = entity.type; return []; }
  }
}

/** Push the first token of a card's start line as a definition reference. */
function pushDefinitionRef(card: { range: SourceRange } | undefined, lines: string[], refs: SourceRange[], tokenIndex = 0): void {
  if (!card) return;
  const lineText = lines[card.range.startLine];
  const tok = lineText ? getTokenRange(lineText, tokenIndex) : undefined;
  if (tok) {
    refs.push({ startLine: card.range.startLine, startCol: tok.start, endLine: card.range.startLine, endCol: tok.end });
  }
}

function findCellReferences(
  doc: McnpDocument, cellId: number, lines: string[], idx: DocumentIndex, includeDecl: boolean
): SourceRange[] {
  const refs: SourceRange[] = [];

  if (includeDecl) pushDefinitionRef(idx.getCell(cellId), lines, refs);

  // #N complement refs across all cells
  for (const c of doc.cells) {
    if (c.geometry.cellRefs) {
      for (const ref of c.geometry.cellRefs) {
        if (ref.id === cellId) refs.push(ref.range);
      }
    }
    // LIKE BUT refs
    if (c.likeCell === cellId && c.likeCellRange) {
      refs.push(c.likeCellRange);
    }
  }

  // Tally cell bins (types 4, 6, 7, 8 use cells)
  for (const tally of doc.tallyCards) {
    if (CELL_TALLY_TYPES.has(tally.tallyType)) {
      for (const bin of tally.bins) {
        for (const entry of bin.entries) {
          if (entry.id === cellId) refs.push(entry.range);
        }
      }
    }
  }

  // CF modifier entityRefs
  for (const mod of doc.tallyModifiers) {
    if ((mod.cardType === 'CF' || mod.cardType === '*CF') && mod.entityRefs) {
      if (mod.entityRefs.includes(cellId)) {
        refs.push(...findModifierTokenPositions(mod, String(cellId), lines));
      }
    }
  }

  return refs;
}

function findSurfaceReferences(
  doc: McnpDocument, surfId: number, lines: string[], idx: DocumentIndex, includeDecl: boolean
): SourceRange[] {
  const refs: SourceRange[] = [];

  if (includeDecl) pushDefinitionRef(idx.getSurface(surfId), lines, refs);

  // Geometry surfaceRefs
  for (const c of doc.cells) {
    for (const ref of c.geometry.surfaceRefs) {
      if (ref.id === surfId) refs.push(ref.range);
    }
  }

  // Tally surface bins (types 1, 2 use surfaces)
  for (const tally of doc.tallyCards) {
    if (SURFACE_TALLY_TYPES.has(tally.tallyType)) {
      for (const bin of tally.bins) {
        for (const entry of bin.entries) {
          if (entry.id === surfId) refs.push(entry.range);
        }
      }
    }
  }

  // SF/FS modifier entityRefs
  for (const mod of doc.tallyModifiers) {
    if ((mod.cardType === 'SF' || mod.cardType === 'FS' || mod.cardType === '*SF' || mod.cardType === '*FS') && mod.entityRefs) {
      if (mod.entityRefs.includes(surfId)) {
        refs.push(...findModifierTokenPositions(mod, String(surfId), lines));
      }
    }
  }

  return refs;
}

function findMaterialReferences(
  doc: McnpDocument, matId: number, lines: string[], idx: DocumentIndex, includeDecl: boolean
): SourceRange[] {
  const refs: SourceRange[] = [];

  if (includeDecl) pushDefinitionRef(idx.getMaterial(matId), lines, refs);

  // Cell usages: cells with materialId === matId
  for (const c of doc.cells) {
    if (c.materialId !== matId) continue;
    if (c.likeCell !== undefined && c.materialIdRange) {
      refs.push(c.materialIdRange); // LIKE BUT MAT= — highlight the value
    } else {
      pushDefinitionRef(c, lines, refs, 1); // Standard cell — token 1
    }
  }

  // MT cards
  for (const tc of doc.thermalCards) {
    if (tc.id === matId) pushDefinitionRef(tc, lines, refs);
  }

  // FM modifier materialRefs
  for (const mod of doc.tallyModifiers) {
    if ((mod.cardType === 'FM' || mod.cardType === '*FM') && mod.materialRefs) {
      if (mod.materialRefs.includes(matId)) {
        refs.push(...findModifierTokenPositions(mod, String(matId), lines));
      }
    }
  }

  return refs;
}

