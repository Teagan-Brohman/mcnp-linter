import { ArrayFill, CellCard, GeometryExpression, SurfaceRef, SourceRange } from '../types';
import { LogicalLine } from './tokenizer';
import { expandShorthand } from './shorthand';

/**
 * Parse an MCNP cell card from a logical line.
 *
 * Supports two forms:
 *   Form 1: j m d geom params   (standard cell definition)
 *   Form 2: j LIKE n BUT params (cell cloning with overrides)
 */
export function parseCellCard(line: LogicalLine): CellCard {
  const text = line.text.trim();
  const tokens = text.split(/\s+/);
  const range: SourceRange = {
    startLine: line.startLine,
    startCol: 0,
    endLine: line.endLine,
    endCol: line.text.length,
  };

  // First token is always the cell number
  if (tokens.length < 2) {
    throw new Error(`Cell card: insufficient tokens (need at least cell number and material)`);
  }
  const id = parseInt(tokens[0], 10);

  // Check for LIKE n BUT form
  if (tokens.length >= 4 && tokens[1].toUpperCase() === 'LIKE') {
    return parseLikeButForm(id, tokens, line, range);
  }

  return parseStandardForm(id, tokens, line, range);
}

/**
 * Parse LIKE n BUT form: j LIKE n BUT param=val ...
 */
function parseLikeButForm(id: number, tokens: string[], line: LogicalLine, range: SourceRange): CellCard {
  const likeCell = parseInt(tokens[2], 10);
  const parameters = new Map<string, string>();

  for (let i = 4; i < tokens.length; i++) {
    parseParameter(tokens[i], parameters);
  }

  // Compute source range for the referenced cell number (tokens[2])
  let likeCellRange: SourceRange | undefined;
  const likeCellToken = tokens[2];
  // Find position of tokens[2] in line.text by walking past tokens[0], [1]
  let pos = line.text.length - line.text.trimStart().length;
  for (let i = 0; i < 3; i++) {
    while (pos < line.text.length && (line.text[pos] === ' ' || line.text[pos] === '\t')) pos++;
    if (i === 2) break; // pos now points to start of tokens[2]
    pos += tokens[i].length;
  }
  likeCellRange = computeTokenRange(line, pos, likeCellToken.length);

  // Extract MAT= override if present
  let materialId = 0;
  let materialIdRange: SourceRange | undefined;
  const matValue = parameters.get('MAT');
  if (matValue) {
    const parsed = parseInt(matValue, 10);
    if (!isNaN(parsed)) {
      materialId = parsed;
      const matMatch = /\bMAT=(\d+)/i.exec(line.text);
      if (matMatch) {
        const valueOffset = matMatch.index + matMatch[0].indexOf('=') + 1;
        materialIdRange = computeTokenRange(line, valueOffset, matValue.length);
      }
    }
  }

  return {
    id,
    materialId,
    materialIdRange,
    geometry: { surfaceRefs: [], raw: '' },
    parameters,
    likeCell,
    likeCellRange,
    range,
  };
}

/**
 * Parse standard form: j m [d] geom params
 */
function parseStandardForm(
  id: number,
  tokens: string[],
  line: LogicalLine,
  range: SourceRange,
): CellCard {
  let idx = 1;

  // Material number
  const materialId = parseInt(tokens[idx], 10);
  idx++;

  // Density: present only if material > 0
  let density: number | undefined;
  if (materialId > 0) {
    if (idx >= tokens.length) {
      throw new Error(`Cell card ${id}: material ${materialId} specified but no density token`);
    }
    density = parseFloat(tokens[idx]);
    idx++;
  }

  // Split remaining tokens into geometry and parameters.
  // Parameters start at the first token containing '='.
  const geomTokens: string[] = [];
  const paramTokens: string[] = [];
  let inParams = false;

  for (let i = idx; i < tokens.length; i++) {
    if (!inParams && tokens[i].includes('=')) {
      inParams = true;
    }
    if (inParams) {
      paramTokens.push(tokens[i]);
    } else {
      geomTokens.push(tokens[i]);
    }
  }

  // Compute actual positions of all tokens in line.text (not the trimmed version).
  // This preserves original spacing for accurate range mapping on continuation lines.
  const tokenPositions: number[] = [];
  {
    let pos = line.text.length - line.text.trimStart().length;
    for (const token of tokens) {
      while (pos < line.text.length && (line.text[pos] === ' ' || line.text[pos] === '\t')) pos++;
      tokenPositions.push(pos);
      pos += token.length;
    }
  }

  const geomStartOffset = idx < tokenPositions.length ? tokenPositions[idx] : line.text.length;

  // Extract geometry directly from line.text to preserve original spacing.
  // This ensures sub-token offsets map correctly to positions in line.text,
  // which is critical for multi-line logical lines.
  let geomEndOffset: number;
  if (paramTokens.length > 0) {
    geomEndOffset = tokenPositions[idx + geomTokens.length];
  } else {
    geomEndOffset = line.text.length;
  }
  let geomEnd = geomEndOffset;
  while (geomEnd > geomStartOffset && (line.text[geomEnd - 1] === ' ' || line.text[geomEnd - 1] === '\t')) geomEnd--;
  const geomTextFromSource = line.text.substring(geomStartOffset, geomEnd);

  const geometry = parseGeometry(geomTextFromSource, line, geomStartOffset);

  // Detect and parse array FILL
  let arrayFill: ArrayFill | undefined;
  const fillIdx = paramTokens.findIndex(t => {
    const eq = t.indexOf('=');
    return eq !== -1 && t.substring(0, eq).toUpperCase().replace('*', '') === 'FILL'
      && /^-?\d+:-?\d+$/.test(t.substring(eq + 1));
  });

  if (fillIdx !== -1) {
    const fillToken = paramTokens[fillIdx];
    const eqIdx = fillToken.indexOf('=');
    const firstRange = fillToken.substring(eqIdx + 1);

    const ranges: [number, number][] = [];
    const [r1, r2] = firstRange.split(':').map(Number);
    ranges.push([r1, r2]);

    // Consume additional range dimensions and universe numbers
    let j = fillIdx + 1;

    // Consume range dimensions (N:M pattern)
    while (j < paramTokens.length && /^-?\d+:-?\d+$/.test(paramTokens[j])) {
      const [a, b] = paramTokens[j].split(':').map(Number);
      ranges.push([a, b]);
      j++;
    }

    // Consume universe numbers until next KEY= token
    const universeTokens: string[] = [];
    while (j < paramTokens.length && !paramTokens[j].includes('=')) {
      universeTokens.push(paramTokens[j]);
      j++;
    }

    if (universeTokens.length > 0) {
      const cleaned = universeTokens.map(t => {
        // Preserve shorthand operators (e.g. 5R, 3I, 2M, 4J)
        if (/^\d+[RIMJrimj]$/i.test(t)) return t;
        const m = t.match(/^(\d+)/);
        return m ? m[1] : t;
      });
      const universes = expandShorthand(cleaned).map(v => Math.round(v));
      arrayFill = { ranges, universes };
      paramTokens.splice(fillIdx + 1, j - fillIdx - 1);
    }
  }

  // Parse parameters
  const parameters = new Map<string, string>();
  for (const pt of paramTokens) {
    parseParameter(pt, parameters);
  }

  return {
    id,
    materialId,
    density,
    geometry,
    parameters,
    arrayFill,
    range,
  };
}

/**
 * Parse a KEY=VALUE parameter token into the map.
 */
function parseParameter(token: string, map: Map<string, string>): void {
  const eqIdx = token.indexOf('=');
  if (eqIdx === -1) return;
  const key = token.substring(0, eqIdx);
  const value = token.substring(eqIdx + 1);
  if (key.length > 0) {
    map.set(key.toUpperCase(), value);
  }
}

interface GeomToken {
  text: string;
  offset: number; // offset within the geometry string
}

/**
 * Sub-tokenize a geometry string, splitting on whitespace, colons, and parentheses
 * while keeping them as separate tokens. Tracks the offset of each token.
 */
function tokenizeGeometry(text: string): GeomToken[] {
  const tokens: GeomToken[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === ' ' || text[i] === '\t') {
      i++;
      continue;
    }
    if (text[i] === '(' || text[i] === ')') {
      tokens.push({ text: text[i], offset: i });
      i++;
      continue;
    }
    if (text[i] === ':') {
      tokens.push({ text: ':', offset: i });
      i++;
      continue;
    }
    let start = i;
    while (i < text.length && text[i] !== ' ' && text[i] !== '\t' &&
           text[i] !== '(' && text[i] !== ')' && text[i] !== ':') {
      i++;
    }
    if (i > start) {
      tokens.push({ text: text.substring(start, i), offset: start });
    }
  }
  return tokens;
}

/**
 * Compute a SourceRange for a token at a given character offset within a logical line.
 * The offset is relative to line.text. For multi-line logical lines, maps the offset
 * back to the correct physical line and column using originalLineNumbers.
 */
function computeTokenRange(line: LogicalLine, charOffset: number, tokenLength: number): SourceRange {
  // For single-line or when no line number mapping is available, use startLine
  if (!line.originalLineNumbers || line.originalLineNumbers.length <= 1) {
    return {
      startLine: line.startLine,
      startCol: charOffset,
      endLine: line.startLine,
      endCol: charOffset + tokenLength,
    };
  }

  // Re-derive part lengths from originalLines to map offset to physical line.
  // Each part was built by: stripInlineComment(origLine).trimEnd(), then strip trailing '&'.
  // Parts are joined with ' ' in line.text.
  const partLengths: number[] = [];
  for (const origLine of line.originalLines) {
    let s = origLine;
    const dollarIdx = s.indexOf('$');
    if (dollarIdx >= 0) s = s.substring(0, dollarIdx);
    s = s.trimEnd();
    if (s.endsWith('&')) s = s.slice(0, -1).trimEnd();
    partLengths.push(s.length);
  }

  // Walk through parts to find which physical line the offset falls in
  let cumOffset = 0;
  for (let i = 0; i < partLengths.length; i++) {
    if (charOffset < cumOffset + partLengths[i]) {
      const colInPart = charOffset - cumOffset;
      return {
        startLine: line.originalLineNumbers[i],
        startCol: colInPart,
        endLine: line.originalLineNumbers[i],
        endCol: colInPart + tokenLength,
      };
    }
    cumOffset += partLengths[i] + 1; // +1 for the joining space
  }

  // Fallback
  return {
    startLine: line.startLine,
    startCol: charOffset,
    endLine: line.startLine,
    endCol: charOffset + tokenLength,
  };
}

/**
 * Parse geometry string into a GeometryExpression.
 * Extracts surface references (signed integers) while tracking
 * the raw geometry string for complement and operator representation.
 *
 * @param rawGeom - The geometry portion of the cell card text
 * @param line - The original logical line (for range computation)
 * @param geomStartOffset - Character offset in line.text where rawGeom begins
 */
function parseGeometry(rawGeom: string, line?: LogicalLine, geomStartOffset?: number): GeometryExpression {
  const tokens = tokenizeGeometry(rawGeom);
  const surfaceRefs: SurfaceRef[] = [];
  const cellRefs: SurfaceRef[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const gt = tokens[i];
    const token = gt.text;

    // Skip operators and grouping
    if (token === ':' || token === '(' || token === ')') {
      continue;
    }

    // Handle # complement operator
    if (token.startsWith('#')) {
      if (token === '#') {
        // Standalone '#' — next token is either '(' (surface complement) or number (cell complement)
        if (i + 1 < tokens.length && tokens[i + 1].text === '(') {
          // #(...) — surfaces inside parens will be extracted by the loop
          continue;
        }
        // #N cell complement — record reference
        if (i + 1 < tokens.length) {
          const nextToken = tokens[i + 1];
          const cellId = parseInt(nextToken.text, 10);
          if (!isNaN(cellId)) {
            const range = (line && geomStartOffset !== undefined)
              ? computeTokenRange(line, geomStartOffset + nextToken.offset, nextToken.text.length)
              : { startLine: 0, startCol: 0, endLine: 0, endCol: 0 };
            cellRefs.push({ id: cellId, sense: '+', range });
          }
        }
        i++;
        continue;
      }
      // #N as single token (e.g. "#3") — cell complement, don't add to surfaceRefs
      if (/^#\d+$/.test(token)) {
        const cellId = parseInt(token.substring(1), 10);
        if (!isNaN(cellId)) {
          const range = (line && geomStartOffset !== undefined)
            ? computeTokenRange(line, geomStartOffset + gt.offset, token.length)
            : { startLine: 0, startCol: 0, endLine: 0, endCol: 0 };
          cellRefs.push({ id: cellId, sense: '+', range });
        }
        continue;
      }
      // #(...) shouldn't happen as a single token after sub-tokenization, but skip if so
      continue;
    }

    // Try to parse as a signed integer (surface reference)
    const ref = parseSurfaceRef(token, line, geomStartOffset !== undefined ? geomStartOffset + gt.offset : undefined);
    if (ref) {
      surfaceRefs.push(ref);
    }
  }

  return { surfaceRefs, cellRefs, raw: rawGeom };
}

/**
 * Try to parse a token as a surface reference (signed integer).
 */
function parseSurfaceRef(token: string, line?: LogicalLine, charOffset?: number): SurfaceRef | undefined {
  if (!/^[+-]?\d+$/.test(token)) {
    return undefined;
  }

  const num = parseInt(token, 10);
  const sense: '+' | '-' = num < 0 || token.startsWith('-') ? '-' : '+';
  const id = Math.abs(num);

  const range: SourceRange = (line && charOffset !== undefined)
    ? computeTokenRange(line, charOffset, token.length)
    : { startLine: 0, startCol: 0, endLine: 0, endCol: 0 };

  return {
    id,
    sense,
    range,
  };
}
