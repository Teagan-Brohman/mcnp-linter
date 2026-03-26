import { McnpDocument } from '../types';
import { getSurfaceHover, getSurfaceTypeHover } from './surfaceHover';
import { getZaidHover } from './zaidHover';
import { getThermalHover } from './thermalHover';
import { getDataCardHover } from './dataCardHover';
import { getElement } from '../data/elements';
import { XsdirData } from '../data/xsdirParser';
import { getCellHover } from './cellHover';
import { DocumentIndex } from '../analysis/documentIndex';
import { UniverseMap } from '../analysis/universeMap';
import { getTokenAtPosition, resolveCellAtLine, getTokenRange, getMaterialIdAtPosition, extractCardName } from '../analysis/lspUtils';
import { splitLines } from '../utils/text';

interface HoverOptions {
  materialDisplay?: 'isotope' | 'zaid';
  xsdirData?: XsdirData;
  idx?: DocumentIndex;
  um?: UniverseMap;
  asciiSurfaceArt?: boolean;
}

/**
 * Get a hover result by dispatching to the appropriate hover function
 * based on the cursor position within the MCNP document.
 */
export function getHover(
  doc: McnpDocument,
  position: { line: number; character: number },
  text: string,
  options: HoverOptions = {}
): string | undefined {
  const lines = splitLines(text);
  if (position.line >= lines.length) {
    return undefined;
  }

  const lineText = lines[position.line];

  // Skip full-line comments (c/C in column 1 followed by blank or end-of-line)
  if (/^[cC]( |\t|$)/.test(lineText)) {
    return undefined;
  }

  const token = getTokenAtPosition(lineText, position.character);
  if (!token) {
    return undefined;
  }

  const idx = options.idx ?? new DocumentIndex(doc);

  const block = idx.getBlockSection(position.line);

  if (block === 'cell') {
    return getCellBlockHover(doc, lineText, position, options, lines, idx);
  }

  if (block === 'data') {
    return getDataBlockHover(doc, token, position, options.xsdirData, idx);
  }

  if (block === 'surface') {
    return getSurfaceTypeHover(token, options.asciiSurfaceArt);
  }

  return undefined;
}

/** Cell hover: checks start-line tokens first (cell id, material id) before iterating surface refs, so the most specific first-line positions take priority over geometry spans. */
function getCellBlockHover(
  doc: McnpDocument,
  lineText: string,
  position: { line: number; character: number },
  options: HoverOptions,
  lines: string[],
  idx: DocumentIndex,
): string | undefined {
  const { um } = options;
  const cell = resolveCellAtLine(idx, doc, position.line);
  if (!cell) {
    return undefined;
  }

  // Check first-line token positions (cell number and material number)
  if (position.line === cell.range.startLine) {
    const tok0 = getTokenRange(lineText, 0);
    if (tok0 && position.character >= tok0.start && position.character < tok0.end) {
      return getCellHover(doc, cell.id, { idx, um });
    }
    const matId = getMaterialIdAtPosition(lineText, position.character);
    if (matId !== undefined) {
      return getMaterialSummary(doc, matId, options, lines, idx);
    }
  }

  // LIKE n BUT — hover on the referenced cell number
  if (cell.likeCell !== undefined && cell.likeCellRange) {
    const r = cell.likeCellRange;
    if (
      position.line === r.startLine &&
      position.character >= r.startCol &&
      position.character < r.endCol
    ) {
      const targetCell = idx?.getCell(cell.likeCell) ?? doc.cells.find(c => c.id === cell.likeCell);
      if (targetCell) {
        const name = extractCardName(targetCell.range.startLine, targetCell.range.endLine, lines);
        const header = name
          ? `**Cell ${cell.likeCell}** — ${name}`
          : `**Cell ${cell.likeCell}** — defined at line ${targetCell.range.startLine + 1}`;
        return header;
      }
      return `**Cell ${cell.likeCell}** — not found`;
    }
  }

  // MAT=N parameter — hover on the material number value
  const matParamHover = getCellParamMaterialHover(lineText, position, doc, options, lines, idx);
  if (matParamHover) return matParamHover;

  for (const ref of cell.geometry.surfaceRefs) {
    if (
      position.line === ref.range.startLine &&
      position.character >= ref.range.startCol &&
      position.character < ref.range.endCol
    ) {
      const surface = idx?.getSurface(ref.id);
      const hover = getSurfaceHover(doc, ref.id, { fileLines: lines, preResolved: surface, asciiSurfaceArt: options.asciiSurfaceArt });
      if (hover) {
        return hover;
      }
    }
  }

  // #N cell complement — hover on the referenced cell number
  if (cell.geometry.cellRefs) {
    for (const ref of cell.geometry.cellRefs) {
      if (position.line === ref.range.startLine &&
          position.character >= ref.range.startCol &&
          position.character < ref.range.endCol) {
        const targetCell = idx?.getCell(ref.id) ?? doc.cells.find(c => c.id === ref.id);
        if (targetCell) {
          const name = extractCardName(targetCell.range.startLine, targetCell.range.endLine, lines);
          return name
            ? `**Cell ${ref.id}** — ${name}`
            : `**Cell ${ref.id}** — defined at line ${targetCell.range.startLine + 1}`;
        }
        return `**Cell ${ref.id}** — not found`;
      }
    }
  }

  return undefined;
}

/**
 * Detect MAT=N in cell parameter tokens and show material hover.
 */
function getCellParamMaterialHover(
  lineText: string,
  position: { line: number; character: number },
  doc: McnpDocument,
  options: HoverOptions,
  lines: string[],
  idx?: DocumentIndex,
): string | undefined {
  const token = getTokenAtPosition(lineText, position.character);
  if (!token) return undefined;
  const match = token.match(/^MAT=(\d+)$/i);
  if (!match) return undefined;
  const matId = parseInt(match[1], 10);
  // Check cursor is on the number part (after "MAT=")
  const tokenStart = lineText.lastIndexOf(token, position.character);
  if (tokenStart < 0) return undefined;
  const eqPos = tokenStart + token.indexOf('=') + 1;
  if (position.character < eqPos) return undefined;
  return getMaterialSummary(doc, matId, options, lines, idx);
}

/**
 * Handle hover in the data block.
 * If the token looks like a ZAID, find the parent material and the entry, and show hover.
 * Uses position-based matching first (for accurate results with duplicate ZAIDs),
 * then falls back to string matching.
 */
function getDataBlockHover(
  doc: McnpDocument,
  token: string,
  position: { line: number; character: number },
  xsdirData?: XsdirData,
  idx?: DocumentIndex,
): string | undefined {
  const dataCardHover = getDataCardHover(token);
  if (dataCardHover) {
    return dataCardHover;
  }

  const blockInfo = idx?.getBlockForLine(position.line);
  if (blockInfo?.type === 'thermal') {
    for (const entry of blockInfo.thermal.tables) {
      if (
        position.line >= entry.range.startLine &&
        position.line <= entry.range.endLine &&
        position.character >= entry.range.startCol &&
        position.character < entry.range.endCol
      ) {
        return getThermalHover(doc, entry, blockInfo.thermal, { xsdirData });
      }
    }
  } else {
    // Fallback: scan all thermal cards when line is unindexed or not a thermal block
    for (const tc of doc.thermalCards) {
      for (const entry of tc.tables) {
        if (
          position.line >= entry.range.startLine &&
          position.line <= entry.range.endLine &&
          position.character >= entry.range.startCol &&
          position.character < entry.range.endCol
        ) {
          return getThermalHover(doc, entry, tc, { xsdirData });
        }
      }
    }
  }

  // A ZAID looks like "92235.80c" or "92235" or "1001.24u"
  const zaidPattern = /^\d+(\.\d+[a-zA-Z])?$/;
  if (!zaidPattern.test(token)) {
    return undefined;
  }

  // Position-based matching — try indexed material first, then remaining
  const indexedMat = blockInfo?.type === 'material' ? blockInfo.material : undefined;
  const materialsToSearch = indexedMat
    ? [indexedMat, ...doc.materials.filter(m => m !== indexedMat)]
    : doc.materials;

  for (const mat of materialsToSearch) {
    for (const entry of mat.components) {
      if (
        position.line >= entry.range.startLine &&
        position.line <= entry.range.endLine &&
        position.character >= entry.range.startCol &&
        position.character < entry.range.endCol
      ) {
        return getZaidHover(doc, entry, mat, { xsdirData });
      }
    }
  }

  // String-match fallback: fires only when no position range matched above.
  // Handles edge cases where a ZAID's parsed range doesn't cover the cursor
  // (e.g. continuation lines, shorthand expansions).
  for (const mat of doc.materials) {
    for (const entry of mat.components) {
      if (entry.zaid === token) {
        return getZaidHover(doc, entry, mat, { xsdirData });
      }
    }
  }

  return undefined;
}

/**
 * Extract a material name from comments near the material card.
 * Checks: 1) inline $ comment on the Mm line, 2) c comment line(s) above.
 */
function getMaterialName(mat: { range: { startLine: number } }, lines: string[]): string | undefined {
  const matLine = mat.range.startLine;
  if (matLine >= lines.length) return undefined;
  return extractCardName(matLine, matLine, lines);
}

/**
 * Build a material summary hover string.
 */
function getMaterialSummary(doc: McnpDocument, matId: number, options: HoverOptions = {}, lines: string[] = [], idx?: DocumentIndex): string | undefined {
  const mat = idx?.getMaterial(matId) ?? doc.materials.find(m => m.id === matId);
  if (!mat) {
    return undefined;
  }

  const display = options.materialDisplay || 'isotope';
  const name = getMaterialName(mat, lines);

  const components = mat.components
    .map(c => {
      if (display === 'isotope') {
        const el = getElement(c.z);
        if (!el) return c.zaid;
        if (c.a === 0) return `${el.name} (nat)`;
        return `${el.symbol}-${c.a}`;
      }
      return c.zaid;
    })
    .join(', ');

  const header = name
    ? `**Material ${mat.id}** \u2014 ${name}`
    : `**Material ${mat.id}** \u2014 defined at line ${mat.range.startLine + 1}`;

  return `${header}\n\nComponents: ${components}`;
}
