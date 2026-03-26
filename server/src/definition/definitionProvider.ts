import { McnpDocument, SourceRange } from '../types';
import { DocumentIndex } from '../analysis/documentIndex';
import { UniverseMap } from '../analysis/universeMap';
import { getTokenAtPosition, resolveCellAtLine, getMaterialIdAtPosition } from '../analysis/lspUtils';
import { splitLines } from '../utils/text';
import { SURFACE_TALLY_TYPES, CELL_TALLY_TYPES } from '../data/tallyTypes';

interface DefinitionOptions {
  idx?: DocumentIndex;
  um?: UniverseMap;
}

interface DefinitionResult {
  range: SourceRange;
  /** URI of the source file. Undefined means same file. */
  uri?: string;
}

/**
 * Get a go-to-definition result.
 *
 * Returns the target location if the cursor is on:
 * - A surface reference in a cell card's geometry → jumps to the surface definition
 * - A material number (second token) in a cell card → jumps to the Mm card
 * - A #N cell complement in a cell card → jumps to the referenced cell card
 *
 * Returns undefined if nothing is found.
 */
export function getDefinition(
  doc: McnpDocument,
  position: { line: number; character: number },
  text: string,
  options: DefinitionOptions = {}
): DefinitionResult | undefined {
  const index = options.idx ?? new DocumentIndex(doc);
  const block = index.getBlockSection(position.line);

  if (block === 'cell') {
    return getCellBlockDefinition(doc, position, text, index, options.um);
  }

  if (block === 'data') {
    return getDataBlockDefinition(doc, position, text, index);
  }

  return undefined;
}

/**
 * Handle definition lookups within the cell block.
 */
function getCellBlockDefinition(
  doc: McnpDocument,
  position: { line: number; character: number },
  text: string,
  idx: DocumentIndex,
  um?: UniverseMap
): DefinitionResult | undefined {
  const lines = splitLines(text);
  const cell = resolveCellAtLine(idx, doc, position.line);
  if (!cell) {
    return undefined;
  }

  const lineText = lines[position.line];
  if (!lineText || position.character >= lineText.length) {
    return undefined;
  }

  // If cursor is on whitespace, nothing to do
  if (/\s/.test(lineText[position.character])) {
    return undefined;
  }

  // LIKE n BUT — jump from the referenced cell number to its definition
  if (cell.likeCell !== undefined && cell.likeCellRange) {
    const r = cell.likeCellRange;
    if (
      position.line === r.startLine &&
      position.character >= r.startCol &&
      position.character < r.endCol
    ) {
      const targetCell = idx.getCell(cell.likeCell);
      return targetCell ? { range: targetCell.range, uri: targetCell.sourceUri } : undefined;
    }
  }

  for (const ref of cell.geometry.surfaceRefs) {
    if (
      position.line === ref.range.startLine &&
      position.character >= ref.range.startCol &&
      position.character < ref.range.endCol
    ) {
      const surface = idx.getSurface(ref.id);
      if (surface) {
        return { range: surface.range, uri: surface.sourceUri };
      }
      return undefined;
    }
  }

  if (position.line === cell.range.startLine) {
    const matId = getMaterialIdAtPosition(lineText, position.character);
    if (matId !== undefined) {
      const mat = idx.getMaterial(matId);
      return mat ? { range: mat.range, uri: mat.sourceUri } : undefined;
    }
  }

  const token = getTokenAtPosition(lineText, position.character);
  if (token) {
    const complementMatch = token.match(/^#(\d+)$/);
    if (complementMatch) {
      const cellId = parseInt(complementMatch[1], 10);
      const targetCell = idx.getCell(cellId);
      if (targetCell) {
        return { range: targetCell.range, uri: targetCell.sourceUri };
      }
      return undefined;
    }

    // FILL=N → jump to first cell with U=N
    if (um) {
      const fillMatch = token.match(/^\*?FILL=(\d+)/i);
      if (fillMatch) {
        const universe = parseInt(fillMatch[1], 10);
        const cells = um.getUniverseCells(universe);
        if (cells.length > 0) {
          const targetCell = idx.getCell(cells[0]);
          return targetCell ? { range: targetCell.range, uri: targetCell.sourceUri } : undefined;
        }
      }

      // U=N → jump to the cell that FILLs this universe
      const uMatch = token.match(/^U=(\d+)/i);
      if (uMatch) {
        const universe = parseInt(uMatch[1], 10);
        for (const c of doc.cells) {
          const fillParam = c.parameters.get('FILL') ?? c.parameters.get('*FILL');
          if (fillParam !== undefined) {
            const fillVal = parseInt(fillParam, 10);
            if (fillVal === universe) {
              return { range: c.range, uri: c.sourceUri };
            }
          }
        }
      }
    }
  }

  return undefined;
}

/**
 * Handle definition lookups within the data block.
 *
 * Supports:
 * - SDEF CEL=N → cell definition
 * - SDEF SUR=N → surface definition
 * - SDEF TR=N  → transform definition
 * - Tally bin numbers → cell or surface definition (based on tally type)
 * - FM material references → material definition
 */
function getDataBlockDefinition(
  _doc: McnpDocument,
  position: { line: number; character: number },
  text: string,
  idx: DocumentIndex
): DefinitionResult | undefined {
  const lines = splitLines(text);
  const lineText = lines[position.line];
  if (!lineText) return undefined;

  const token = getTokenAtPosition(lineText, position.character);
  if (!token) return undefined;

  const blockInfo = idx.getBlockForLine(position.line);

  // SDEF keyword references: CEL=N, SUR=N, TR=N
  if (blockInfo?.type === 'sdef') {
    const celMatch = token.match(/^CEL=(\d+)$/i);
    if (celMatch) {
      const cell = idx.getCell(parseInt(celMatch[1], 10));
      return cell ? { range: cell.range, uri: cell.sourceUri } : undefined;
    }
    const surMatch = token.match(/^SUR=(\d+)$/i);
    if (surMatch) {
      const surf = idx.getSurface(parseInt(surMatch[1], 10));
      return surf ? { range: surf.range, uri: surf.sourceUri } : undefined;
    }
    const trMatch = token.match(/^TR=(\d+)$/i);
    if (trMatch) {
      const tr = idx.getTransform(parseInt(trMatch[1], 10));
      return tr ? { range: tr.range } : undefined;
    }
  }

  // Tally bin references: jump to cell or surface definition
  if (blockInfo?.type === 'tally') {
    const num = parseInt(token, 10);
    if (!isNaN(num) && /^\d+$/.test(token)) {
      if (SURFACE_TALLY_TYPES.has(blockInfo.tally.tallyType)) {
        const surf = idx.getSurface(num);
        return surf ? { range: surf.range, uri: surf.sourceUri } : undefined;
      }
      if (CELL_TALLY_TYPES.has(blockInfo.tally.tallyType)) {
        const cell = idx.getCell(num);
        return cell ? { range: cell.range, uri: cell.sourceUri } : undefined;
      }
    }
  }

  // Tally modifier FM: numeric token may be a material reference
  if (blockInfo?.type === 'tallyModifier') {
    const mod = blockInfo.tallyModifier;
    if (mod.cardType === 'FM' || mod.cardType === '*FM') {
      const num = parseInt(token, 10);
      if (!isNaN(num) && /^\d+$/.test(token)) {
        const mat = idx.getMaterial(num);
        if (mat) return { range: mat.range, uri: mat.sourceUri };
      }
    }
  }

  return undefined;
}
