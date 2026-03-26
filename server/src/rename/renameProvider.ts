import { McnpDocument, SourceRange } from '../types';
import { DocumentIndex } from '../analysis/documentIndex';
import { getEntityAtPosition, getTokenRange, findModifierTokenPositions } from '../analysis/lspUtils';
import { splitLines } from '../utils/text';
import { SURFACE_TALLY_TYPES, CELL_TALLY_TYPES } from '../data/tallyTypes';

export function prepareRename(
  doc: McnpDocument,
  position: { line: number; character: number },
  text: string,
  options: { idx?: DocumentIndex } = {}
): { range: SourceRange; placeholder: string } | undefined {
  const idx = options.idx ?? new DocumentIndex(doc);
  const entity = getEntityAtPosition(doc, position, text, idx);
  if (!entity) return undefined;
  return { range: entity.range, placeholder: String(entity.id) };
}

export function getRenameEdits(
  doc: McnpDocument,
  position: { line: number; character: number },
  text: string,
  newName: string,
  options: { idx?: DocumentIndex } = {}
): { range: SourceRange; newText: string }[] {
  const idx = options.idx ?? new DocumentIndex(doc);
  const entity = getEntityAtPosition(doc, position, text, idx);
  if (!entity) return [];

  const newId = parseInt(newName, 10);
  if (isNaN(newId) || newId < 1) return [];

  const lines = splitLines(text);
  const edits: { range: SourceRange; newText: string }[] = [];

  switch (entity.type) {
    case 'cell':
      collectCellRenameEdits(doc, entity.id, newName, lines, idx, edits);
      break;
    case 'surface':
      collectSurfaceRenameEdits(doc, entity.id, newName, lines, idx, edits);
      break;
    case 'material':
      collectMaterialRenameEdits(doc, entity.id, newName, lines, idx, edits);
      break;
    default: break;
  }

  return edits;
}

function collectCellRenameEdits(
  doc: McnpDocument, cellId: number, newName: string, lines: string[], idx: DocumentIndex,
  edits: { range: SourceRange; newText: string }[]
): void {
  // Definition: token 0 on start line
  const cell = idx.getCell(cellId);
  if (cell) {
    const lineText = lines[cell.range.startLine];
    const tok0 = lineText ? getTokenRange(lineText, 0) : undefined;
    if (tok0) {
      edits.push({ range: { startLine: cell.range.startLine, startCol: tok0.start, endLine: cell.range.startLine, endCol: tok0.end }, newText: newName });
    }
  }

  // #N complement refs
  for (const c of doc.cells) {
    if (c.geometry.cellRefs) {
      for (const ref of c.geometry.cellRefs) {
        if (ref.id === cellId) {
          // The ref.range covers #N or just the number — compute the numeric portion
          const lineText = lines[ref.range.startLine];
          const refText = lineText?.substring(ref.range.startCol, ref.range.endCol) ?? '';
          if (refText.startsWith('#')) {
            // Replace just the number part after #
            edits.push({
              range: { startLine: ref.range.startLine, startCol: ref.range.startCol + 1, endLine: ref.range.endLine, endCol: ref.range.endCol },
              newText: newName
            });
          } else {
            edits.push({ range: ref.range, newText: newName });
          }
        }
      }
    }
    // LIKE BUT refs
    if (c.likeCell === cellId && c.likeCellRange) {
      edits.push({ range: c.likeCellRange, newText: newName });
    }
  }

  // Tally cell bins
  for (const tally of doc.tallyCards) {
    if (CELL_TALLY_TYPES.has(tally.tallyType)) {
      for (const bin of tally.bins) {
        for (const entry of bin.entries) {
          if (entry.id === cellId) {
            edits.push({ range: entry.range, newText: newName });
          }
        }
      }
    }
  }

  // CF modifier entityRefs — scan source text for matching tokens
  for (const mod of doc.tallyModifiers) {
    if ((mod.cardType === 'CF' || mod.cardType === '*CF') && mod.entityRefs) {
      if (mod.entityRefs.includes(cellId)) {
        for (const range of findModifierTokenPositions(mod, String(cellId), lines)) {
          edits.push({ range, newText: newName });
        }
      }
    }
  }
}

function collectSurfaceRenameEdits(
  doc: McnpDocument, surfId: number, newName: string, lines: string[], idx: DocumentIndex,
  edits: { range: SourceRange; newText: string }[]
): void {
  // Definition: token 0 on start line
  const surf = idx.getSurface(surfId);
  if (surf) {
    const lineText = lines[surf.range.startLine];
    const tok0 = lineText ? getTokenRange(lineText, 0) : undefined;
    if (tok0) {
      // Surface may have *N or +N modifier prefix
      const tokenText = lineText.substring(tok0.start, tok0.end);
      if (tokenText.startsWith('*') || tokenText.startsWith('+')) {
        edits.push({
          range: { startLine: surf.range.startLine, startCol: tok0.start + 1, endLine: surf.range.startLine, endCol: tok0.end },
          newText: newName
        });
      } else {
        edits.push({
          range: { startLine: surf.range.startLine, startCol: tok0.start, endLine: surf.range.startLine, endCol: tok0.end },
          newText: newName
        });
      }
    }
  }

  // Geometry surfaceRefs
  for (const c of doc.cells) {
    for (const ref of c.geometry.surfaceRefs) {
      if (ref.id === surfId) {
        // ref.range covers ±N — compute the numeric portion
        const lineText = lines[ref.range.startLine];
        const refText = lineText?.substring(ref.range.startCol, ref.range.endCol) ?? '';
        if (refText.startsWith('-') || refText.startsWith('+')) {
          edits.push({
            range: { startLine: ref.range.startLine, startCol: ref.range.startCol + 1, endLine: ref.range.endLine, endCol: ref.range.endCol },
            newText: newName
          });
        } else {
          edits.push({ range: ref.range, newText: newName });
        }
      }
    }
  }

  // Tally surface bins
  for (const tally of doc.tallyCards) {
    if (SURFACE_TALLY_TYPES.has(tally.tallyType)) {
      for (const bin of tally.bins) {
        for (const entry of bin.entries) {
          if (entry.id === surfId) {
            edits.push({ range: entry.range, newText: newName });
          }
        }
      }
    }
  }

  // SF/FS modifier entityRefs — scan source text for matching tokens
  for (const mod of doc.tallyModifiers) {
    if ((mod.cardType === 'SF' || mod.cardType === 'FS' || mod.cardType === '*SF' || mod.cardType === '*FS') && mod.entityRefs) {
      if (mod.entityRefs.includes(surfId)) {
        for (const range of findModifierTokenPositions(mod, String(surfId), lines)) {
          edits.push({ range, newText: newName });
        }
      }
    }
  }
}

function collectMaterialRenameEdits(
  doc: McnpDocument, matId: number, newName: string, lines: string[], idx: DocumentIndex,
  edits: { range: SourceRange; newText: string }[]
): void {
  // Definition: MN — replace just the number portion
  const mat = idx.getMaterial(matId);
  if (mat) {
    const lineText = lines[mat.range.startLine];
    const tok0 = lineText ? getTokenRange(lineText, 0) : undefined;
    if (tok0) {
      // Token is "MN" — number starts at startCol + 1
      edits.push({
        range: { startLine: mat.range.startLine, startCol: tok0.start + 1, endLine: mat.range.startLine, endCol: tok0.end },
        newText: newName
      });
    }
  }

  // Cell usages: material number is token 1
  for (const c of doc.cells) {
    if (c.materialId === matId) {
      const lineText = lines[c.range.startLine];
      const tok1 = lineText ? getTokenRange(lineText, 1) : undefined;
      if (tok1) {
        edits.push({
          range: { startLine: c.range.startLine, startCol: tok1.start, endLine: c.range.startLine, endCol: tok1.end },
          newText: newName
        });
      }
    }
  }

  // MT cards: MTN — number starts at startCol + 2
  for (const tc of doc.thermalCards) {
    if (tc.id === matId) {
      const lineText = lines[tc.range.startLine];
      const tok0 = lineText ? getTokenRange(lineText, 0) : undefined;
      if (tok0) {
        edits.push({
          range: { startLine: tc.range.startLine, startCol: tok0.start + 2, endLine: tc.range.startLine, endCol: tok0.end },
          newText: newName
        });
      }
    }
  }

  // FM modifier materialRefs — scan source text for matching tokens
  for (const mod of doc.tallyModifiers) {
    if ((mod.cardType === 'FM' || mod.cardType === '*FM') && mod.materialRefs) {
      if (mod.materialRefs.includes(matId)) {
        for (const range of findModifierTokenPositions(mod, String(matId), lines)) {
          edits.push({ range, newText: newName });
        }
      }
    }
  }
}

