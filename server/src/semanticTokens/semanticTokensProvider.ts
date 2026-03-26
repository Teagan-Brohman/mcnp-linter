import { SemanticTokensBuilder } from 'vscode-languageserver/node';
import { McnpDocument } from '../types';
import { getTokenRange } from '../analysis/lspUtils';
import { splitLines } from '../utils/text';

export const TOKEN_TYPES = ['class', 'interface', 'variable', 'number', 'keyword'];
export const TOKEN_MODIFIERS = ['declaration'];

interface RawToken {
  line: number;
  col: number;
  length: number;
  type: number;
  modifier: number;
}

const KEYWORD_RE = /\b(IMP:[A-Z]|VOL|PWT|EXT:[A-Z]|FCL:[A-Z]|WWN|DXC|NONU|PD|TMP|TRCL|LAT|FILL|ELPT:[A-Z]|COSY|BFLCL|UNC:[A-Z]|U)=/gi;

export function getSemanticTokens(
  doc: McnpDocument, text: string
): SemanticTokensBuilder {
  const lines = splitLines(text);
  const tokens: RawToken[] = [];

  // --- Cell cards ---
  for (const cell of doc.cells) {
    const startLine = cell.range.startLine;
    const lineText = lines[startLine];
    if (!lineText) continue;

    // Cell number declaration (token 0 on start line)
    const tok0 = getTokenRange(lineText, 0);
    if (tok0) {
      tokens.push({ line: startLine, col: tok0.start, length: tok0.end - tok0.start, type: 0, modifier: 1 });
    }

    // Material ID reference (token 1 on start line, non-zero)
    if (cell.materialId > 0) {
      const tok1 = getTokenRange(lineText, 1);
      if (tok1) {
        tokens.push({ line: startLine, col: tok1.start, length: tok1.end - tok1.start, type: 2, modifier: 0 });
      }
    }

    // Surface refs in geometry
    for (const ref of cell.geometry.surfaceRefs) {
      tokens.push({
        line: ref.range.startLine,
        col: ref.range.startCol,
        length: ref.range.endCol - ref.range.startCol,
        type: 1,
        modifier: 0,
      });
    }

    // Cell complement #N refs
    if (cell.geometry.cellRefs) {
      for (const ref of cell.geometry.cellRefs) {
        tokens.push({
          line: ref.range.startLine,
          col: ref.range.startCol,
          length: ref.range.endCol - ref.range.startCol,
          type: 0,
          modifier: 0,
        });
      }
    }

    // Parameter keywords on all lines of the cell
    for (let l = cell.range.startLine; l <= cell.range.endLine && l < lines.length; l++) {
      const ln = lines[l];
      KEYWORD_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = KEYWORD_RE.exec(ln)) !== null) {
        tokens.push({ line: l, col: m.index, length: m[1].length, type: 4, modifier: 0 });
      }
    }
  }

  // --- Surface cards ---
  for (const surf of doc.surfaces) {
    const startLine = surf.range.startLine;
    const lineText = lines[startLine];
    if (!lineText) continue;

    const tok0 = getTokenRange(lineText, 0);
    if (tok0) {
      // If surface has a modifier (* or +), token 0 includes it — check if the first
      // token starts with * or +; if so the actual ID text starts at tok0.start
      tokens.push({ line: startLine, col: tok0.start, length: tok0.end - tok0.start, type: 1, modifier: 1 });
    }
  }

  // --- Material cards ---
  for (const mat of doc.materials) {
    const startLine = mat.range.startLine;
    const lineText = lines[startLine];
    if (!lineText) continue;

    // Material Mm declaration (token 0 on start line)
    const tok0 = getTokenRange(lineText, 0);
    if (tok0) {
      tokens.push({ line: startLine, col: tok0.start, length: tok0.end - tok0.start, type: 2, modifier: 1 });
    }

    // ZAID entries
    for (const comp of mat.components) {
      tokens.push({
        line: comp.range.startLine,
        col: comp.range.startCol,
        length: comp.range.endCol - comp.range.startCol,
        type: 3,
        modifier: 0,
      });
    }
  }

  // Sort by document order (line ascending, then column ascending)
  tokens.sort((a, b) => a.line - b.line || a.col - b.col);

  // Push to builder
  const builder = new SemanticTokensBuilder();
  for (const t of tokens) {
    builder.push(t.line, t.col, t.length, t.type, t.modifier);
  }
  return builder;
}
