import { SelectionRange, Range } from 'vscode-languageserver/node';
import { McnpDocument } from '../types';
import { DocumentIndex, getCardFromBlock } from '../analysis/documentIndex';
import { getWordBoundsAtPosition } from '../analysis/lspUtils';
import { splitLines } from '../utils/text';

export function getSelectionRanges(
  doc: McnpDocument,
  positions: { line: number; character: number }[],
  text: string,
  options: { idx?: DocumentIndex } = {}
): SelectionRange[] {
  const idx = options.idx ?? new DocumentIndex(doc);
  const lines = splitLines(text);
  return positions.map(pos => buildSelectionRange(doc, pos, lines, idx));
}

function buildSelectionRange(
  doc: McnpDocument,
  pos: { line: number; character: number },
  lines: string[],
  idx: DocumentIndex
): SelectionRange {
  const lineText = pos.line < lines.length ? lines[pos.line] : '';

  // 1. Token range: find word boundaries around cursor
  const bounds = getWordBoundsAtPosition(lineText, pos.character);
  const tokenRange = bounds
    ? Range.create(pos.line, bounds.start, pos.line, bounds.end)
    : Range.create(pos.line, pos.character, pos.line, pos.character);

  // 2. Line range
  const lineRange = Range.create(pos.line, 0, pos.line, lineText.length);

  // 3. Card range (multi-line cards only)
  const cardRange = getCardRange(doc, pos.line, idx);

  // 4. Block range
  const blockRange = getBlockRange(doc, pos.line, idx);

  // Build chain innermost → outermost via .parent
  let result: SelectionRange = { range: tokenRange };

  // Add line as parent if different from token
  if (!rangesEqual(tokenRange, lineRange)) {
    result = { range: tokenRange, parent: { range: lineRange } };
  }

  // Add card as parent if multi-line and different from line
  if (cardRange && !rangesEqual(cardRange, lineRange)) {
    const outermost = getOutermost(result);
    outermost.parent = { range: cardRange };
  }

  // Add block as parent if different from card (or line if no card)
  if (blockRange) {
    const outermost = getOutermost(result);
    if (!rangesEqual(blockRange, outermost.range)) {
      outermost.parent = { range: blockRange };
    }
  }

  return result;
}

function getCardRange(
  _doc: McnpDocument,
  line: number,
  idx: DocumentIndex
): Range | undefined {
  const blockInfo = idx.getBlockForLine(line);
  if (!blockInfo) return undefined;

  const r = getCardFromBlock(blockInfo).range;
  // Only return card range for multi-line cards
  if (r.endLine <= r.startLine) return undefined;

  return Range.create(r.startLine, r.startCol, r.endLine, r.endCol);
}

function getBlockRange(
  doc: McnpDocument,
  line: number,
  idx: DocumentIndex
): Range | undefined {
  const section = idx.getBlockSection(line);
  if (!section) return undefined;

  let cards: { range: { startLine: number; startCol: number; endLine: number; endCol: number } }[];
  if (section === 'cell') {
    cards = doc.cells;
  } else if (section === 'surface') {
    cards = doc.surfaces;
  } else {
    // data: union of all data card arrays
    cards = [
      ...doc.materials,
      ...doc.thermalCards,
      ...doc.tallyCards,
      ...doc.tallyModifiers,
      ...doc.readCards,
      ...doc.parameterDataCards,
    ];
  }

  if (cards.length === 0) return undefined;

  const startLine = cards.reduce((min, c) => Math.min(min, c.range.startLine), Infinity);
  const endLine = cards.reduce((max, c) => Math.max(max, c.range.endLine), -1);
  const endCol = cards
    .filter(c => c.range.endLine === endLine)
    .reduce((max, c) => Math.max(max, c.range.endCol), 0);

  return Range.create(startLine, 0, endLine, endCol);
}

function rangesEqual(a: Range, b: Range): boolean {
  return (
    a.start.line === b.start.line &&
    a.start.character === b.start.character &&
    a.end.line === b.end.line &&
    a.end.character === b.end.character
  );
}

function getOutermost(sr: SelectionRange): SelectionRange {
  let current = sr;
  while (current.parent) {
    current = current.parent;
  }
  return current;
}
