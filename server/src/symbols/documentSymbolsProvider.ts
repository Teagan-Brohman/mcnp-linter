import { DocumentSymbol, SymbolKind, Range } from 'vscode-languageserver/node';
import { McnpDocument } from '../types';
import { extractCardName, getTokenRange, toRange } from '../analysis/lspUtils';
import { splitLines } from '../utils/text';

export function getDocumentSymbols(
  doc: McnpDocument, text: string
): DocumentSymbol[] {
  const lines = splitLines(text);
  const symbols: DocumentSymbol[] = [];

  for (const cell of doc.cells) {
    const name = extractCardName(cell.range.startLine, cell.range.endLine, lines) || `Cell ${cell.id}`;
    const detail = cell.materialId === 0 ? 'void' : `mat ${cell.materialId}`;
    const sel = idSelectionRange(lines, cell.range.startLine, 0);
    symbols.push(makeSymbol(`Cell ${cell.id}`, detail, SymbolKind.Class, cell.range, sel, name !== `Cell ${cell.id}` ? name : undefined));
  }

  for (const surf of doc.surfaces) {
    const name = extractCardName(surf.range.startLine, surf.range.endLine, lines);
    const sel = idSelectionRange(lines, surf.range.startLine, 0);
    symbols.push(makeSymbol(`Surface ${surf.id}`, surf.type, SymbolKind.Interface, surf.range, sel, name ?? undefined));
  }

  for (const mat of doc.materials) {
    const name = extractCardName(mat.range.startLine, mat.range.endLine, lines);
    const detail = `${mat.components.length} component${mat.components.length !== 1 ? 's' : ''}`;
    const sel = idSelectionRange(lines, mat.range.startLine, 0);
    symbols.push(makeSymbol(`Material ${mat.id}`, detail, SymbolKind.Variable, mat.range, sel, name ?? undefined));
  }

  for (const tc of doc.thermalCards) {
    const tableNames = tc.tables.map(t => t.name).join(', ');
    const sel = idSelectionRange(lines, tc.range.startLine, 0);
    symbols.push(makeSymbol(`MT ${tc.id}`, tableNames, SymbolKind.Event, tc.range, sel));
  }

  for (const tally of doc.tallyCards) {
    const prefix = tally.prefix || '';
    const tallyName = `${prefix}F${tally.tallyNumber}:${tally.particles}`;
    const typeNames: Record<number, string> = { 1: 'current', 2: 'flux', 4: 'track length', 5: 'point detector', 6: 'collision', 7: 'fission energy', 8: 'pulse height' };
    const detail = typeNames[tally.tallyType] || `type ${tally.tallyType}`;
    const sel = idSelectionRange(lines, tally.range.startLine, 0);
    symbols.push(makeSymbol(tallyName, detail, SymbolKind.Function, tally.range, sel));
  }

  return symbols;
}

/** Compute a selection range for the first token on a line (the card identifier). */
function idSelectionRange(lines: string[], line: number, tokenIndex: number): Range {
  const lineText = line < lines.length ? lines[line] : '';
  const tok = getTokenRange(lineText, tokenIndex);
  if (tok) {
    return { start: { line, character: tok.start }, end: { line, character: tok.end } };
  }
  return { start: { line, character: 0 }, end: { line, character: lineText.length } };
}

function makeSymbol(
  name: string, detail: string, kind: SymbolKind,
  cardRange: { startLine: number; startCol: number; endLine: number; endCol: number },
  selectionRange: Range,
  comment?: string
): DocumentSymbol {
  const range: Range = toRange(cardRange);
  const displayName = comment ? `${name} \u2014 ${comment}` : name;
  return DocumentSymbol.create(displayName, detail, kind, range, selectionRange);
}
