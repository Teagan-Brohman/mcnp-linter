import { FoldingRange, FoldingRangeKind } from 'vscode-languageserver/node';
import { McnpDocument } from '../types';

export function getFoldingRanges(doc: McnpDocument): FoldingRange[] {
  const ranges: FoldingRange[] = [];

  // Block-level folds
  addBlockFold(ranges, doc.cells);
  addBlockFold(ranges, doc.surfaces);

  // Data block: union of all data card arrays
  const dataCards = [
    ...doc.materials,
    ...doc.thermalCards,
    ...doc.tallyCards,
    ...doc.tallyModifiers,
    ...doc.readCards,
    ...doc.parameterDataCards,
  ];
  addBlockFold(ranges, dataCards);

  // Card-level folds: any multi-line card
  const allCards = [...doc.cells, ...doc.surfaces, ...dataCards];
  for (const card of allCards) {
    if (card.range.endLine > card.range.startLine) {
      ranges.push({ startLine: card.range.startLine, endLine: card.range.endLine });
    }
  }

  return ranges;
}

function addBlockFold(ranges: FoldingRange[], cards: { range: { startLine: number; endLine: number } }[]): void {
  if (cards.length === 0) return;
  const startLine = cards.reduce((min, c) => Math.min(min, c.range.startLine), Infinity);
  const endLine = cards.reduce((max, c) => Math.max(max, c.range.endLine), -1);
  if (endLine > startLine) {
    ranges.push({ startLine, endLine, kind: FoldingRangeKind.Region });
  }
}
