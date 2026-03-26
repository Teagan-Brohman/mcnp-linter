import {
  CallHierarchyItem,
  CallHierarchyIncomingCall,
  CallHierarchyOutgoingCall,
  Range,
  SymbolKind,
} from 'vscode-languageserver/node';

import { McnpDocument, CellCard } from '../types';
import { DocumentIndex } from '../analysis/documentIndex';
import { UniverseMap } from '../analysis/universeMap';
import { extractCardName } from '../analysis/lspUtils';
import { splitLines } from '../utils/text';

interface CallHierarchyOptions {
  idx?: DocumentIndex;
  um?: UniverseMap;
}

function makeCellItem(cell: CellCard, text: string, uri: string): CallHierarchyItem {
  const lines = splitLines(text);
  const name = extractCardName(cell.range.startLine, cell.range.endLine, lines);
  const range = Range.create(
    cell.range.startLine, cell.range.startCol,
    cell.range.endLine, cell.range.endCol
  );
  const selRange = Range.create(
    cell.range.startLine, 0,
    cell.range.startLine, String(cell.id).length
  );
  return {
    name: `Cell ${cell.id}`,
    kind: SymbolKind.Class,
    uri,
    range,
    selectionRange: selRange,
    detail: name,
  };
}

/**
 * Parse cell ID from item name (format: "Cell N").
 */
function parseCellId(item: CallHierarchyItem): number | undefined {
  const match = item.name.match(/^Cell\s+(\d+)$/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Prepare a call hierarchy item for the cell at the cursor position.
 */
export function prepareCallHierarchy(
  _doc: McnpDocument,
  position: { line: number; character: number },
  text: string,
  uri: string,
  options: CallHierarchyOptions = {}
): CallHierarchyItem[] | null {
  const idx = options.idx;
  if (!idx) return null;

  const section = idx.getBlockSection(position.line);
  if (section !== 'cell') return null;

  const blockInfo = idx.getBlockForLine(position.line);
  const cell = blockInfo?.type === 'cell' ? blockInfo.cell : undefined;
  if (!cell) return null;

  return [makeCellItem(cell, text, uri)];
}

/**
 * Get incoming calls: cells that FILL the universe this cell belongs to.
 */
export function getIncomingCalls(
  doc: McnpDocument,
  item: CallHierarchyItem,
  text: string,
  uri: string,
  options: CallHierarchyOptions = {}
): CallHierarchyIncomingCall[] {
  const um = options.um;
  if (!um) return [];

  const cellId = parseCellId(item);
  if (cellId === undefined) return [];

  const universe = um.getCellUniverse(cellId);
  if (universe === undefined || universe === 0) return [];

  // Find cells that FILL this universe
  const result: CallHierarchyIncomingCall[] = [];
  for (const cell of doc.cells) {
    if (um.getCellFill(cell.id) === universe) {
      const fromItem = makeCellItem(cell, text, uri);
      result.push({
        from: fromItem,
        fromRanges: [fromItem.range],
      });
    }
  }

  return result;
}

/**
 * Get outgoing calls: cells in the universe this cell fills.
 */
export function getOutgoingCalls(
  _doc: McnpDocument,
  item: CallHierarchyItem,
  text: string,
  uri: string,
  options: CallHierarchyOptions = {}
): CallHierarchyOutgoingCall[] {
  const um = options.um;
  if (!um) return [];

  const cellId = parseCellId(item);
  if (cellId === undefined) return [];

  const fillUniverse = um.getCellFill(cellId);
  if (fillUniverse === undefined) return [];

  const cellIds = um.getUniverseCells(fillUniverse);
  const result: CallHierarchyOutgoingCall[] = [];

  for (const id of cellIds) {
    const cellCard = um.getCellCard(id);
    if (!cellCard) continue;
    const toItem = makeCellItem(cellCard, text, uri);
    result.push({
      to: toItem,
      fromRanges: [toItem.range],
    });
  }

  return result;
}
