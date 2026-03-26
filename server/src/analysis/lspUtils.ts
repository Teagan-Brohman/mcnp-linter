import { McnpDocument, CellCard, SourceRange, TallyModifierCard } from '../types';
import { DocumentIndex } from './documentIndex';
import { splitLines } from '../utils/text';


/** Convert a SourceRange to an LSP-compatible range object. */
export function toRange(r: SourceRange): { start: { line: number; character: number }; end: { line: number; character: number } } {
  return { start: { line: r.startLine, character: r.startCol }, end: { line: r.endLine, character: r.endCol } };
}

/**
 * Extract a descriptive name from MCNP comments near a card.
 * Checks for inline $ comments on lines startLine..endLine, then searches
 * up to 5 comment lines above startLine for a non-separator name.
 */
export function extractCardName(startLine: number, endLine: number, fileLines: string[]): string | undefined {
  for (let i = startLine; i <= endLine && i < fileLines.length; i++) {
    const dollarIdx = fileLines[i].indexOf('$');
    if (dollarIdx >= 0) {
      const comment = fileLines[i].substring(dollarIdx + 1).trim();
      if (comment.length > 0) return comment;
    }
  }
  for (let i = startLine - 1; i >= 0 && i >= startLine - 5; i--) {
    const line = fileLines[i];
    if (!/^[cC][\s]/.test(line) && !/^[cC]$/.test(line)) break;
    const commentText = line.substring(1).trim();
    if (commentText.length === 0) continue;
    if (/^[-=*]+$/.test(commentText)) continue;
    const cleaned = commentText.replace(/^[-=*\s]+/, '').replace(/[-=*\s]+$/, '');
    if (cleaned.length > 0) return cleaned;
  }
  return undefined;
}

/**
 * Return the CellCard containing the given line.
 * Uses O(1) idx lookup when available; falls back to linear scan for tests that omit idx.
 */
export function resolveCellAtLine(idx: DocumentIndex | undefined, doc: McnpDocument, line: number): CellCard | undefined {
  const blockInfo = idx?.getBlockForLine(line);
  const cell = blockInfo?.type === 'cell' ? blockInfo.cell : undefined;
  return cell ?? doc.cells.find(c => line >= c.range.startLine && line <= c.range.endLine);
}

/**
 * Return the character range of the Nth token (0-based) in a line, or undefined if absent.
 * Tokens are whitespace-separated non-empty strings from the trimmed line text.
 */
export function getTokenRange(lineText: string, tokenIndex: number): { start: number; end: number } | undefined {
  const tokens = lineText.trim().split(/\s+/).filter(t => t.length > 0);
  if (tokens.length <= tokenIndex) return undefined;
  let searchFrom = 0;
  for (let i = 0; i <= tokenIndex; i++) {
    const start = lineText.indexOf(tokens[i], searchFrom);
    if (start < 0) return undefined;
    const end = start + tokens[i].length;
    if (i === tokenIndex) return { start, end };
    searchFrom = end;
  }
  return undefined;
}

/**
 * If the cursor is on the second token of a cell's first line and that token parses
 * as a positive material ID, return it. Otherwise return undefined.
 */
export function getMaterialIdAtPosition(lineText: string, character: number): number | undefined {
  const tok1 = getTokenRange(lineText, 1);
  if (!tok1 || character < tok1.start || character >= tok1.end) return undefined;
  const matId = parseInt(lineText.slice(tok1.start, tok1.end), 10);
  return (!isNaN(matId) && matId > 0) ? matId : undefined;
}

/** Find the start/end column of the whitespace-delimited word at `character`. */
export function getWordBoundsAtPosition(lineText: string, character: number): { start: number; end: number } | undefined {
  if (character >= lineText.length || /\s/.test(lineText[character])) {
    return undefined;
  }
  let start = character;
  let end = character;
  while (start > 0 && !/\s/.test(lineText[start - 1])) start--;
  while (end < lineText.length && !/\s/.test(lineText[end])) end++;
  return start < end ? { start, end } : undefined;
}

export function getTokenAtPosition(lineText: string, character: number): string | undefined {
  const bounds = getWordBoundsAtPosition(lineText, character);
  return bounds ? lineText.substring(bounds.start, bounds.end) : undefined;
}

interface EntityAtPosition {
  type: 'cell' | 'surface' | 'material';
  id: number;
  range: SourceRange;
}

/**
 * Identify the MCNP entity (cell, surface, or material) at the given cursor position.
 * Used by references and rename to determine what the user is pointing at.
 */
export function getEntityAtPosition(
  doc: McnpDocument,
  position: { line: number; character: number },
  text: string,
  idx: DocumentIndex
): EntityAtPosition | undefined {
  const lines = splitLines(text);
  const block = idx.getBlockSection(position.line);
  const lineText = lines[position.line];
  if (!lineText || position.character >= lineText.length) return undefined;
  if (/\s/.test(lineText[position.character])) return undefined;

  if (block === 'cell') {
    const cell = resolveCellAtLine(idx, doc, position.line);
    if (!cell) return undefined;

    // Cell number: token 0 on the start line
    if (position.line === cell.range.startLine) {
      const tok0 = getTokenRange(lineText, 0);
      if (tok0 && position.character >= tok0.start && position.character < tok0.end) {
        return { type: 'cell', id: cell.id, range: { startLine: position.line, startCol: tok0.start, endLine: position.line, endCol: tok0.end } };
      }
      // Material ID: token 1 on the start line
      const tok1 = getTokenRange(lineText, 1);
      if (tok1 && position.character >= tok1.start && position.character < tok1.end) {
        const matId = parseInt(lineText.slice(tok1.start, tok1.end), 10);
        if (!isNaN(matId) && matId > 0) {
          return { type: 'material', id: matId, range: { startLine: position.line, startCol: tok1.start, endLine: position.line, endCol: tok1.end } };
        }
      }
    }

    // Surface refs in geometry
    for (const ref of cell.geometry.surfaceRefs) {
      if (positionInRange(position, ref.range)) {
        return { type: 'surface', id: ref.id, range: ref.range };
      }
    }

    // #N cell complement refs
    if (cell.geometry.cellRefs) {
      for (const ref of cell.geometry.cellRefs) {
        if (positionInRange(position, ref.range)) {
          return { type: 'cell', id: ref.id, range: ref.range };
        }
      }
    }

    // Standalone '#' — cursor is on the '#' character but the cellRef range
    // only covers the number token after it. Check if cursor is on '#' with
    // the next character starting a cellRef range.
    if (lineText[position.character] === '#') {
      if (cell.geometry.cellRefs) {
        for (const ref of cell.geometry.cellRefs) {
          if (ref.range.startLine === position.line &&
              ref.range.startCol === position.character + 1) {
            return { type: 'cell', id: ref.id, range: { startLine: position.line, startCol: position.character, endLine: ref.range.endLine, endCol: ref.range.endCol } };
          }
          // Also handle '# N' with whitespace: '#' is at cursor, ref starts further right
          if (ref.range.startLine === position.line &&
              ref.range.startCol > position.character) {
            const gap = lineText.substring(position.character + 1, ref.range.startCol);
            if (/^\s*$/.test(gap)) {
              return { type: 'cell', id: ref.id, range: { startLine: position.line, startCol: position.character, endLine: ref.range.endLine, endCol: ref.range.endCol } };
            }
          }
        }
      }
    }

    // LIKE BUT cell reference
    if (cell.likeCell !== undefined && cell.likeCellRange) {
      const r = cell.likeCellRange;
      if (position.line === r.startLine &&
          position.character >= r.startCol &&
          position.character < r.endCol) {
        return { type: 'cell', id: cell.likeCell, range: r };
      }
    }

    // LIKE BUT MAT= material reference
    if (cell.likeCell !== undefined && cell.materialId > 0 && cell.materialIdRange) {
      const r = cell.materialIdRange;
      if (positionInRange(position, r)) {
        return { type: 'material', id: cell.materialId, range: r };
      }
    }

    return undefined;
  }

  if (block === 'surface') {
    // Surface number: token 0 on start line
    const blockInfo = idx.getBlockForLine(position.line);
    const surf = blockInfo?.type === 'surface' ? blockInfo.surface : undefined;
    if (surf && position.line === surf.range.startLine) {
      const tok0 = getTokenRange(lineText, 0);
      if (tok0 && position.character >= tok0.start && position.character < tok0.end) {
        return { type: 'surface', id: surf.id, range: { startLine: position.line, startCol: tok0.start, endLine: position.line, endCol: tok0.end } };
      }
    }
    return undefined;
  }

  if (block === 'data') {
    const blockInfo = idx.getBlockForLine(position.line);
    // Material card: first token is MN
    if (blockInfo?.type === 'material' && position.line === blockInfo.material.range.startLine) {
      const tok0 = getTokenRange(lineText, 0);
      if (tok0 && position.character >= tok0.start && position.character < tok0.end) {
        return { type: 'material', id: blockInfo.material.id, range: { startLine: position.line, startCol: tok0.start, endLine: position.line, endCol: tok0.end } };
      }
    }
    // Thermal card: first token is MTN — treat as material ref
    if (blockInfo?.type === 'thermal' && position.line === blockInfo.thermal.range.startLine) {
      const tok0 = getTokenRange(lineText, 0);
      if (tok0 && position.character >= tok0.start && position.character < tok0.end) {
        return { type: 'material', id: blockInfo.thermal.id, range: { startLine: position.line, startCol: tok0.start, endLine: position.line, endCol: tok0.end } };
      }
    }
    return undefined;
  }

  return undefined;
}

/** Check if a cursor position falls within a SourceRange (handles multi-line spans). */
function positionInRange(pos: { line: number; character: number }, range: SourceRange): boolean {
  if (pos.line < range.startLine || pos.line > range.endLine) return false;
  if (pos.line === range.startLine && pos.character < range.startCol) return false;
  if (pos.line === range.endLine && pos.character >= range.endCol) return false;
  return true;
}

/**
 * Scan a tally modifier card's source lines for whitespace-delimited tokens
 * matching `targetId`, and return their precise ranges.
 * Skips the first token on the start line (the card keyword like "CF4").
 */
export function findModifierTokenPositions(
  mod: TallyModifierCard, targetId: string, lines: string[]
): SourceRange[] {
  const results: SourceRange[] = [];
  const pattern = new RegExp(`(?<=^|\\s)${targetId}(?=\\s|$)`, 'g');
  for (let ln = mod.range.startLine; ln <= mod.range.endLine && ln < lines.length; ln++) {
    const lineText = lines[ln];
    let searchFrom = 0;
    if (ln === mod.range.startLine) {
      const tok0 = getTokenRange(lineText, 0);
      if (tok0) searchFrom = tok0.end;
    }
    const searchText = lineText.substring(searchFrom);
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(searchText)) !== null) {
      const col = searchFrom + m.index;
      results.push({ startLine: ln, startCol: col, endLine: ln, endCol: col + targetId.length });
    }
  }
  return results;
}
