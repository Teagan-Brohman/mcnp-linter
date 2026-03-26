import { CodeLens, Range, Command, Position } from 'vscode-languageserver/node';
import { McnpDocument } from '../types';
import { SURFACE_TALLY_TYPES, CELL_TALLY_TYPES } from '../data/tallyTypes';

/** Maximum number of CodeLens items rendered (prevents VS Code UI overload on huge models). */
const MAX_LENSES = 2000;

export function getCodeLenses(
  doc: McnpDocument, _text: string, uri: string,
  options: { cursorLine?: number } = {}
): CodeLens[] {
  const cursorLine = options.cursorLine;
  // Count references in O(n) without calling findReferences per entity.
  // Only count entities defined in this file (sourceUri means READ-file entity;
  // their line numbers are relative to external files, not this document).
  const cellRefs = new Map<number, number>();
  const surfRefs = new Map<number, number>();
  const matRefs = new Map<number, number>();

  // Geometry surface refs and cell complement refs from all cells
  for (const cell of doc.cells) {
    for (const ref of cell.geometry.surfaceRefs) {
      surfRefs.set(ref.id, (surfRefs.get(ref.id) ?? 0) + 1);
    }
    if (cell.geometry.cellRefs) {
      for (const ref of cell.geometry.cellRefs) {
        cellRefs.set(ref.id, (cellRefs.get(ref.id) ?? 0) + 1);
      }
    }
    // LIKE n BUT ref
    if (cell.likeCell !== undefined) {
      cellRefs.set(cell.likeCell, (cellRefs.get(cell.likeCell) ?? 0) + 1);
    }
    // Cell's material usage
    if (cell.materialId > 0) {
      matRefs.set(cell.materialId, (matRefs.get(cell.materialId) ?? 0) + 1);
    }
  }

  // Tally bin refs
  for (const tally of doc.tallyCards) {
    const targetMap = SURFACE_TALLY_TYPES.has(tally.tallyType) ? surfRefs
      : CELL_TALLY_TYPES.has(tally.tallyType) ? cellRefs
      : undefined;
    if (!targetMap) continue;
    for (const bin of tally.bins) {
      for (const entry of bin.entries) {
        targetMap.set(entry.id, (targetMap.get(entry.id) ?? 0) + 1);
      }
    }
  }

  // Tally modifier entity refs
  for (const mod of doc.tallyModifiers) {
    if ((mod.cardType === 'CF' || mod.cardType === '*CF') && mod.entityRefs) {
      for (const id of mod.entityRefs) cellRefs.set(id, (cellRefs.get(id) ?? 0) + 1);
    }
    if ((mod.cardType === 'SF' || mod.cardType === 'FS' || mod.cardType === '*SF' || mod.cardType === '*FS') && mod.entityRefs) {
      for (const id of mod.entityRefs) surfRefs.set(id, (surfRefs.get(id) ?? 0) + 1);
    }
    if ((mod.cardType === 'FM' || mod.cardType === '*FM') && mod.materialRefs) {
      for (const id of mod.materialRefs) matRefs.set(id, (matRefs.get(id) ?? 0) + 1);
    }
  }

  const lenses: CodeLens[] = [];

  const addLens = (_id: number, count: number, line: number): boolean => {
    if (count === 0) return true;
    if (lenses.length >= MAX_LENSES) return false;
    const title = count === 1 ? '1 reference' : `${count} references`;
    lenses.push({
      range: Range.create(line, 0, line, 0),
      command: Command.create(title, 'mcnp.findReferences', uri, Position.create(line, 0)),
    });
    return true;
  };

  for (const cell of doc.cells) {
    if (cell.sourceUri) continue;
    if (cursorLine !== undefined && (cursorLine < cell.range.startLine || cursorLine > cell.range.endLine)) continue;
    if (!addLens(cell.id, cellRefs.get(cell.id) ?? 0, cell.range.startLine)) break;
  }

  for (const surface of doc.surfaces) {
    if (surface.sourceUri) continue;
    if (cursorLine !== undefined && (cursorLine < surface.range.startLine || cursorLine > surface.range.endLine)) continue;
    if (!addLens(surface.id, surfRefs.get(surface.id) ?? 0, surface.range.startLine)) break;
  }

  for (const material of doc.materials) {
    if (material.sourceUri) continue;
    if (cursorLine !== undefined && (cursorLine < material.range.startLine || cursorLine > material.range.endLine)) continue;
    if (!addLens(material.id, matRefs.get(material.id) ?? 0, material.range.startLine)) break;
  }

  return lenses;
}
