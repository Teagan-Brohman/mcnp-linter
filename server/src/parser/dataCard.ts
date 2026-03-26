import { MaterialCard, MaterialKeyword, ZaidEntry, ThermalCard, ThermalTableEntry, ParameterDataCard, ReadCard, TallyCard, TallyBinGroup, TallyBinEntry, TallyType, TallyModifierCard, TallyModifierCardType, TallyChain, TallyChainLevel, TransformCard, ModeCard, NpsCard, CtmeCard, KcodeCard, KsrcCard, SdefCard, SourceDistCard, ImpCard, SourceRange } from '../types';
import { LogicalLine } from './tokenizer';

/**
 * Regex for cards starting with M that are NOT material cards.
 * MODE, MESH, MPLOT, MPN, MT<digits>, MX<digits>, MGOPT, MPHYS
 */
const NON_MATERIAL_RE = /^(MODE|MESH|MPLOT|MPN|MT\d|MX\d|MGOPT|MPHYS)/i;

/**
 * Regex matching a thermal scattering card: MT followed by digits then whitespace.
 */
const THERMAL_RE = /^MT(\d+)(\s|$)/i;

/**
 * Returns true if the text represents an MCNP thermal scattering (MT) card.
 */
export function isThermalCard(text: string): boolean {
  return THERMAL_RE.test(text.trim());
}

/**
 * Parse an MCNP thermal scattering card from a logical line.
 *
 * Format: MTn table1 table2 ...
 * Each table is an S(a,b) identifier like "lwtr.10t" or "grph.10t".
 */
export function parseThermalCard(line: LogicalLine): ThermalCard {
  const text = line.text.trim();

  const match = text.match(/^MT(\d+)\s*/i);
  if (!match) {
    throw new Error(`Not a valid thermal card: ${text}`);
  }

  const id = parseInt(match[1], 10);
  const remainder = text.substring(match[0].length);
  const remainderOffset = match[0].length;

  const tokens = remainder.length > 0 ? remainder.split(/\s+/).filter(t => t.length > 0) : [];

  const tables: ThermalTableEntry[] = [];

  let searchFrom = 0;
  for (const token of tokens) {
    const idx = remainder.indexOf(token, searchFrom);
    const textOffset = remainderOffset + idx;
    searchFrom = idx + token.length;

    const dotIdx = token.indexOf('.');
    let identifier: string;
    let suffix: string;
    if (dotIdx >= 0) {
      identifier = token.substring(0, dotIdx);
      suffix = token.substring(dotIdx + 1);
    } else {
      identifier = token;
      suffix = '';
    }

    const range = getTokenPhysicalRange(line, token, textOffset);

    tables.push({ name: token, identifier, suffix, range });
  }

  return {
    id,
    tables,
    range: {
      startLine: line.startLine,
      startCol: 0,
      endLine: line.endLine,
      endCol: text.length,
    },
  };
}

/**
 * Regex matching U, LAT, or FILL data cards.
 * Must be exact keyword followed by whitespace and numbers.
 * U must not be followed by letters (to exclude UNIVT, etc.)
 */
const PARAM_CARD_RE = /^(U|LAT|FILL)\s+[\d\s.-]/i;

export function isParameterDataCard(text: string): boolean {
  const trimmed = text.trim();
  // Reject things like "U235" or "UNIVT" — keyword must be standalone
  if (/^U\d/i.test(trimmed)) return false;
  if (/^U[A-Z]/i.test(trimmed)) return false;
  return PARAM_CARD_RE.test(trimmed);
}

export function parseParameterDataCard(line: LogicalLine): ParameterDataCard {
  const text = line.text.trim();
  const tokens = text.split(/\s+/);
  const keyword = tokens[0].toUpperCase();
  const values = tokens.slice(1).map(t => parseInt(t, 10)).filter(n => !isNaN(n));

  return {
    keyword,
    values,
    range: {
      startLine: line.startLine,
      startCol: 0,
      endLine: line.endLine,
      endCol: line.text.length,
    },
  };
}

const READ_RE = /^READ\s+FILE\s*=\s*(\S+)/i;

export function isReadCard(text: string): boolean {
  return READ_RE.test(text.trim());
}

export function parseReadCard(line: LogicalLine): ReadCard {
  const match = line.text.trim().match(READ_RE);
  if (!match) throw new Error('Invalid READ card');
  return {
    filename: match[1],
    range: { startLine: line.startLine, startCol: 0, endLine: line.endLine, endCol: line.text.length },
  };
}

/**
 * Regex matching a coordinate transformation card: TRn or *TRn.
 */
const TRANSFORM_RE = /^[*]?TR(\d+)(\s|$)/i;

export function isTransformCard(text: string): boolean {
  return TRANSFORM_RE.test(text.trim());
}

export function parseTransformCard(line: LogicalLine): TransformCard {
  const text = line.text.trim();
  const match = text.match(/^[*]?TR(\d+)/i);
  if (!match) throw new Error('Invalid transform card');
  return {
    id: parseInt(match[1], 10),
    range: { startLine: line.startLine, startCol: 0, endLine: line.endLine, endCol: text.length },
  };
}

const MODE_RE = /^MODE\s+/i;

export function isModeCard(text: string): boolean {
  return MODE_RE.test(text.trim());
}

export function parseModeCard(line: LogicalLine): ModeCard {
  const text = line.text.trim();
  const match = text.match(/^MODE\s+/i);
  if (!match) throw new Error('Invalid MODE card');
  const remainder = text.substring(match[0].length).trim();
  const particles = remainder.split(/\s+/).filter(t => t.length > 0).map(p => p.toUpperCase());
  return {
    particles,
    range: { startLine: line.startLine, startCol: 0, endLine: line.endLine, endCol: text.length },
  };
}

const NPS_RE = /^NPS\s+/i;

export function isNpsCard(text: string): boolean {
  return NPS_RE.test(text.trim());
}

export function parseNpsCard(line: LogicalLine): NpsCard {
  const text = line.text.trim();
  const match = text.match(/^NPS\s+(\S+)/i);
  if (!match) throw new Error('Invalid NPS card');
  return {
    count: parseFloat(match[1]),
    range: { startLine: line.startLine, startCol: 0, endLine: line.endLine, endCol: text.length },
  };
}

const CTME_RE = /^CTME\s+/i;

export function isCtmeCard(text: string): boolean {
  return CTME_RE.test(text.trim());
}

export function parseCtmeCard(line: LogicalLine): CtmeCard {
  const text = line.text.trim();
  const match = text.match(/^CTME\s+(\S+)/i);
  if (!match) throw new Error('Invalid CTME card');
  return {
    minutes: parseFloat(match[1]),
    range: { startLine: line.startLine, startCol: 0, endLine: line.endLine, endCol: text.length },
  };
}

const KCODE_RE = /^KCODE\s+/i;

export function isKcodeCard(text: string): boolean {
  return KCODE_RE.test(text.trim());
}

export function parseKcodeCard(line: LogicalLine): KcodeCard {
  const text = line.text.trim();
  const tokens = text.split(/\s+/);
  if (tokens.length < 5) throw new Error('KCODE requires at least 4 parameters');
  return {
    nsrck: parseInt(tokens[1], 10),
    rkk: parseFloat(tokens[2]),
    ikz: parseInt(tokens[3], 10),
    kct: parseInt(tokens[4], 10),
    range: { startLine: line.startLine, startCol: 0, endLine: line.endLine, endCol: text.length },
  };
}

const KSRC_RE = /^KSRC\s+/i;

export function isKsrcCard(text: string): boolean {
  return KSRC_RE.test(text.trim());
}

export function parseKsrcCard(line: LogicalLine): KsrcCard {
  const text = line.text.trim();
  const match = text.match(/^KSRC\s+/i);
  if (!match) throw new Error('Invalid KSRC card');
  const remainder = text.substring(match[0].length).trim();
  const tokens = remainder.split(/\s+/).filter(t => t.length > 0);
  const values = tokens.map(t => parseFloat(t));

  const points: [number, number, number][] = [];
  for (let i = 0; i + 2 < values.length; i += 3) {
    points.push([values[i], values[i + 1], values[i + 2]]);
  }

  return {
    points,
    rawValueCount: values.length,
    range: { startLine: line.startLine, startCol: 0, endLine: line.endLine, endCol: text.length },
  };
}

const VALID_TALLY_TYPES = new Set([1, 2, 4, 5, 6, 7, 8]);
const TALLY_RE = /^([*+]?)F(\d+)(?::([A-Z,]+))?\s/i;

export function isTallyCard(text: string): boolean {
  const trimmed = text.trim();
  const match = trimmed.match(TALLY_RE);
  if (!match) return false;
  const tallyNum = parseInt(match[2], 10);
  const lastDigit = tallyNum % 10;
  return VALID_TALLY_TYPES.has(lastDigit);
}

/**
 * Parse a repeated-structure tally chain from a parenthesized group like
 * "(11 < 16[-10:10 -10:10 -10:10] < 17)" or "(U=2 < 3)".
 */
function parseTallyChain(text: string, lineRange: SourceRange): TallyChain {
  const inner = text.slice(text.startsWith('(') ? 1 : 0, text.endsWith(')') ? -1 : undefined).trim();
  // Split on < to get levels (left = innermost, right = outermost)
  const levelTexts = inner.split('<').map(s => s.trim());
  const levels: TallyChainLevel[] = [];

  for (const lt of levelTexts) {
    const level: TallyChainLevel = { cells: [], cellRanges: [] };

    const uMatch = lt.match(/U\s*=\s*(\d+)/i);
    if (uMatch) {
      level.universeRef = parseInt(uMatch[1], 10);
      levels.push(level);
      continue;
    }

    // Check for T
    if (/\bT\b/i.test(lt)) level.hasTotal = true;

    let remaining = lt.replace(/\bT\b/gi, '').trim();

    // Extract bracket content: e.g., "16[-10:10 -10:10 -10:10]"
    const bracketMatch = remaining.match(/(\d+)\[([^\]]+)\]/);
    if (bracketMatch) {
      const cellId = parseInt(bracketMatch[1], 10);
      level.cells.push(cellId);
      level.cellRanges.push(lineRange);

      const indexText = bracketMatch[2].trim();
      const dims: [number, number][] = [];
      const parts = indexText.split(/\s+/);
      for (const part of parts) {
        if (part.includes(':')) {
          const [lo, hi] = part.split(':').map(Number);
          dims.push([lo, hi]);
        } else {
          const v = parseInt(part, 10);
          dims.push([v, v]);
        }
      }
      level.latticeIndices = { dimensions: dims, range: lineRange };

      remaining = remaining.replace(/\d+\[[^\]]+\]/, '').trim();
    }

    // Parse remaining cell numbers (space-separated, may have inner parens for grouping)
    const cellTokens = remaining.replace(/[()]/g, ' ').split(/\s+/).filter(t => t.length > 0);
    for (const ct of cellTokens) {
      const num = parseInt(ct, 10);
      if (!isNaN(num)) {
        level.cells.push(num);
        level.cellRanges.push(lineRange);
      }
    }

    levels.push(level);
  }

  return { levels, range: lineRange };
}

export function parseTallyCard(line: LogicalLine): TallyCard {
  const trimmed = line.text.trim();
  const headerMatch = trimmed.match(TALLY_RE);
  if (!headerMatch) throw new Error('Invalid tally card');

  const prefixChar = headerMatch[1];
  const prefix: '*' | '+' | undefined = prefixChar === '*' || prefixChar === '+' ? prefixChar : undefined;
  const tallyNumber = parseInt(headerMatch[2], 10);
  const tallyTypeRaw = tallyNumber % 10;
  if (!VALID_TALLY_TYPES.has(tallyTypeRaw)) {
    throw new Error(`Invalid tally type ${tallyTypeRaw} in tally card`);
  }
  const tallyType = tallyTypeRaw as TallyType;
  const particles = (headerMatch[3] || '').toUpperCase();

  const headerLen = headerMatch[0].length;
  const binText = trimmed.substring(headerLen).trim();
  const bins: TallyBinGroup[] = [];
  const chains: TallyChain[] = [];
  let hasTotal = false;

  const lineRange = { startLine: line.startLine, startCol: 0, endLine: line.endLine, endCol: line.text.length };

  // First pass: extract parenthesized groups that are RS chains (contain < or [)
  // and collect remaining text as simple bin content
  const chainRanges: [number, number][] = []; // [start, end] indices into binText
  let depth = 0;
  let groupStart = -1;
  for (let ci = 0; ci < binText.length; ci++) {
    if (binText[ci] === '(') {
      if (depth === 0) groupStart = ci;
      depth++;
    } else if (binText[ci] === ')') {
      depth--;
      if (depth === 0 && groupStart >= 0) {
        const groupText = binText.substring(groupStart, ci + 1);
        if (groupText.includes('<') || groupText.includes('[')) {
          chains.push(parseTallyChain(groupText, lineRange));
          chainRanges.push([groupStart, ci + 1]);
        }
        groupStart = -1;
      }
    }
  }

  // Build simple bin text by removing chain groups
  let simpleBinText = binText;
  // Remove chain ranges from right to left to preserve indices
  for (let ri = chainRanges.length - 1; ri >= 0; ri--) {
    const [start, end] = chainRanges[ri];
    simpleBinText = simpleBinText.substring(0, start) + simpleBinText.substring(end);
  }
  simpleBinText = simpleBinText.trim();

  // Parse simple bins. Parenthesized tokens (e.g. "(1 2)") form a shared group entry;
  // bare numbers become singleton entries. `openGroup` is non-null iff inside parens.
  let openGroup: TallyBinEntry[] | null = null;
  const tokens = simpleBinText.split(/\s+/).filter(t => t.length > 0);

  for (const token of tokens) {
    if (token.toUpperCase() === 'T') { hasTotal = true; continue; }

    if (token.startsWith('(')) {
      openGroup = [];
      const inner = token.slice(1).replace(/\)$/, '');
      const num = parseFloat(inner);
      if (!isNaN(num) && inner.length > 0) openGroup.push({ id: num, range: lineRange });
      if (token.endsWith(')')) { bins.push({ entries: openGroup, range: lineRange }); openGroup = null; }
      continue;
    }

    if (token.endsWith(')') && openGroup) {
      const num = parseFloat(token.slice(0, -1));
      if (!isNaN(num)) openGroup.push({ id: num, range: lineRange });
      bins.push({ entries: openGroup, range: lineRange });
      openGroup = null;
      continue;
    }

    const num = parseFloat(token);
    if (isNaN(num)) continue;
    if (openGroup) {
      openGroup.push({ id: num, range: lineRange });
    } else {
      bins.push({ entries: [{ id: num, range: lineRange }], range: lineRange });
    }
  }

  const result: TallyCard = { tallyNumber, tallyType, particles, prefix, bins, hasTotal, range: lineRange };
  if (chains.length > 0) {
    result.chains = chains;
  }
  return result;
}

/**
 * Regex matching a material card: M or m followed by digits then whitespace (or end of string).
 */
const MATERIAL_RE = /^[Mm](\d+)(\s|$)/;

/**
 * Returns true if the text represents an MCNP material card (Mn).
 */
export function isMaterialCard(text: string): boolean {
  const trimmed = text.trim();
  if (NON_MATERIAL_RE.test(trimmed)) return false;
  return MATERIAL_RE.test(trimmed);
}

/**
 * Parse a ZAID string like "92235.80c" or "1001" into its components.
 */
function parseZaid(token: string): { zaid: string; z: number; a: number; library?: string } {
  const dotIdx = token.indexOf('.');
  let intPart: number;
  let library: string | undefined;

  if (dotIdx >= 0) {
    intPart = parseInt(token.substring(0, dotIdx), 10);
    library = token.substring(dotIdx + 1);
  } else {
    intPart = parseInt(token, 10);
  }

  const z = Math.floor(intPart / 1000);
  const a = intPart % 1000;

  return { zaid: token, z, a, library };
}

/**
 * Returns true if the token looks like a ZAID (digits, optionally with a dot+library suffix).
 * Distinguished from a pure number (fraction) by context, not by this check alone.
 */
function isKeywordToken(token: string): boolean {
  return token.includes('=');
}

/**
 * Find the position of a token in `line.text` starting from `searchFrom`,
 * and return the physical line/column range.
 */
function getTokenPhysicalRange(
  line: LogicalLine,
  token: string,
  textOffset: number
): { startLine: number; startCol: number; endLine: number; endCol: number } {
  // Find the token in the original lines for accurate physical positioning
  // Walk through originalLines to find where this token appears

  // First, figure out which original line contains this text offset
  // by reconstructing the text-part boundaries
  const originalLines = line.originalLines;
  let runningOffset = 0;

  for (let i = 0; i < originalLines.length; i++) {
    const raw = originalLines[i];

    // Strip inline comment
    const dollarIdx = raw.indexOf('$');
    let stripped = dollarIdx >= 0 ? raw.substring(0, dollarIdx) : raw;
    stripped = stripped.trimEnd();

    // Remove trailing ampersand
    if (stripped.endsWith('&')) {
      stripped = stripped.substring(0, stripped.length - 1).trimEnd();
    }

    // Use full stripped length (including leading spaces) since line.text
    // preserves them — the tokenizer joins textParts that retain indentation.
    const partLength = stripped.length;

    if (i > 0) {
      runningOffset += 1; // the ' ' joiner
    }

    const partStart = runningOffset;
    const partEnd = runningOffset + partLength;

    if (textOffset >= partStart && textOffset < partEnd) {
      const col = textOffset - partStart;
      const physLine = approximatePhysicalLine(line, i);

      return {
        startLine: physLine,
        startCol: col,
        endLine: physLine,
        endCol: col + token.length,
      };
    }

    runningOffset += partLength;
  }

  // Fallback
  return {
    startLine: line.startLine,
    startCol: 0,
    endLine: line.startLine,
    endCol: token.length,
  };
}

// Approximation: assumes no comment lines between continuations (LogicalLine lacks per-line offsets).
function approximatePhysicalLine(line: LogicalLine, origIdx: number): number {
  return line.startLine + origIdx;
}

/**
 * Parse an MCNP material card from a logical line.
 *
 * Format: Mn zaid1 frac1 zaid2 frac2 ... [KEY=value ...]
 * Keywords (KEY=value) can appear anywhere among the ZAID/fraction pairs.
 */
export function parseMaterialCard(line: LogicalLine): MaterialCard {
  const text = line.text.trim();

  // Extract material number from Mn prefix
  const match = text.match(/^[Mm](\d+)\s*/);
  if (!match) {
    throw new Error(`Not a valid material card: ${text}`);
  }

  const id = parseInt(match[1], 10);
  const remainder = text.substring(match[0].length);

  // Track position within the full `text` string for token position mapping.
  // `remainder` starts at this offset in `text`:
  const remainderOffset = match[0].length;

  const tokens = remainder.length > 0 ? remainder.split(/\s+/) : [];

  // Build a list of token positions within `text`
  const tokenOffsets: number[] = [];
  {
    let searchFrom = 0;
    for (const tok of tokens) {
      const idx = remainder.indexOf(tok, searchFrom);
      tokenOffsets.push(remainderOffset + idx);
      searchFrom = idx + tok.length;
    }
  }

  const components: ZaidEntry[] = [];
  const keywords = new Map<MaterialKeyword, string>();

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (isKeywordToken(token)) {
      // KEY=value
      const eqIdx = token.indexOf('=');
      const key = token.substring(0, eqIdx);
      const value = token.substring(eqIdx + 1);
      keywords.set(key.toUpperCase() as MaterialKeyword, value);
      i++;
    } else {
      // Should be a ZAID followed by a fraction
      const zaidInfo = parseZaid(token);
      const tokenTextOffset = tokenOffsets[i];
      i++;

      // Next non-keyword token is the fraction
      let fraction = 0;
      let fractionRange: SourceRange | undefined;
      if (i < tokens.length && !isKeywordToken(tokens[i])) {
        const fracToken = tokens[i];
        const fracOffset = tokenOffsets[i];
        fraction = parseFloat(fracToken);
        fractionRange = getTokenPhysicalRange(line, fracToken, fracOffset);
        i++;
      }

      // Compute physical range for this ZAID token
      const range = getTokenPhysicalRange(line, token, tokenTextOffset);

      const entry: ZaidEntry = {
        zaid: zaidInfo.zaid,
        z: zaidInfo.z,
        a: zaidInfo.a,
        library: zaidInfo.library,
        fraction,
        range,
        fractionRange,
      };
      components.push(entry);
    }
  }

  return {
    id,
    components,
    keywords,
    range: {
      startLine: line.startLine,
      startCol: 0,
      endLine: line.endLine,
      endCol: text.length,
    },
  };
}

/**
 * Tally modifier card detection and parsing.
 * Covers: E, T, C, FC, FM, FQ, DE, DF, EM, TM, CM, CF, SF, FS, SD, FT cards.
 */
const MODIFIER_RE = /^(\*?)(?:FC|FM|FQ|FS|FT|TF|DE|DF|EM|TM|CM|CF|SF|SD|E|T|C)(\d+)\s/i;
// Pre-compiled [unstarred, starred, pattern] tuples; avoids string concatenation casts at runtime
const MODIFIER_PREFIX_RES: Array<[TallyModifierCardType, TallyModifierCardType, RegExp]> = (
  ['FC', 'FM', 'FQ', 'FS', 'FT', 'TF', 'DE', 'DF', 'EM', 'TM', 'CM', 'CF', 'SF', 'SD', 'E', 'T', 'C'] as TallyModifierCardType[]
).map(t => [t, `*${t}` as TallyModifierCardType, new RegExp(`^(\\*?)${t}(\\d+)\\s`, 'i')]);

export function isTallyModifier(text: string): boolean {
  return MODIFIER_RE.test(text.trim());
}

export function parseTallyModifier(line: LogicalLine): TallyModifierCard {
  const trimmed = line.text.trim();
  let cardType: TallyModifierCardType | '' = '';
  let tallyNumber = 0;
  let restStart = 0;

  for (const [baseType, starredType, pattern] of MODIFIER_PREFIX_RES) {
    const match = trimmed.match(pattern);
    if (match) {
      cardType = match[1] ? starredType : baseType;
      tallyNumber = parseInt(match[2], 10);
      restStart = match[0].length;
      break;
    }
  }
  if (!cardType) throw new Error('Invalid tally modifier card');

  const rest = trimmed.substring(restStart).trim();
  const values = rest.split(/\s+/).filter(t => t.length > 0);
  const range = { startLine: line.startLine, startCol: 0, endLine: line.endLine, endCol: line.text.length };

  let entityRefs: number[] | undefined;
  if (cardType === 'CF' || cardType === '*CF' || cardType === 'SF' || cardType === '*SF' || cardType === 'FS' || cardType === '*FS') {
    entityRefs = values.map(v => parseInt(v, 10)).filter(n => !isNaN(n));
  }

  let materialRefs: number[] | undefined;
  if (cardType === 'FM' || cardType === '*FM') {
    const numericValues = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
    if (numericValues.length >= 2 && numericValues[1] > 0 && Number.isInteger(numericValues[1])) {
      materialRefs = [numericValues[1]];
    }
  }

  return { cardType, tallyNumber, values, entityRefs, materialRefs, range };
}

/**
 * Regex matching an SDEF card.
 */
const SDEF_RE = /^SDEF(\s|$)/i;

export function isSdefCard(text: string): boolean {
  return SDEF_RE.test(text.trim());
}

/**
 * Parse an MCNP SDEF (source definition) card from a logical line.
 *
 * Format: SDEF KEY=value KEY=value ...
 * Some keywords take multi-value arguments (e.g. POS=x y z, AXS=x y z).
 * Strategy: find all KEY= positions and each keyword's value extends from
 * after the `=` to the start of the next KEY= token.
 */
export function parseSdefCard(line: LogicalLine): SdefCard {
  const text = line.text.trim();
  const match = text.match(/^SDEF\s*/i);
  if (!match) throw new Error('Invalid SDEF card');

  const remainder = text.substring(match[0].length);
  const keywords = new Map<string, string>();
  const keywordRanges = new Map<string, SourceRange>();
  const lineRange: SourceRange = { startLine: line.startLine, startCol: 0, endLine: line.endLine, endCol: text.length };

  // Find all KEY= positions
  const keyPattern = /([A-Z]+)\s*=/gi;
  const keyPositions: { key: string; valueStart: number; matchStart: number }[] = [];
  let km;
  while ((km = keyPattern.exec(remainder)) !== null) {
    keyPositions.push({
      key: km[1].toUpperCase(),
      valueStart: km.index + km[0].length,
      matchStart: km.index,
    });
  }

  for (let i = 0; i < keyPositions.length; i++) {
    const { key, valueStart } = keyPositions[i];
    const valueEnd = i + 1 < keyPositions.length
      ? keyPositions[i + 1].matchStart
      : remainder.length;
    const value = remainder.substring(valueStart, valueEnd).trim();
    keywords.set(key, value);
    keywordRanges.set(key, lineRange);
  }

  return { keywords, keywordRanges, range: lineRange };
}

/**
 * Source distribution cards: SI, SP, SB, DS followed by a distribution number.
 */
const SOURCE_DIST_RE = /^(SI|SP|SB|DS)(\d+)\s/i;

export function isSourceDistCard(text: string): boolean {
  return SOURCE_DIST_RE.test(text.trim());
}

export function parseSourceDistCard(line: LogicalLine): SourceDistCard {
  const text = line.text.trim();
  const match = text.match(/^(SI|SP|SB|DS)(\d+)\s*/i);
  if (!match) throw new Error('Invalid source distribution card');
  const cardType = match[1].toUpperCase() as 'SI' | 'SP' | 'SB' | 'DS';
  const distNumber = parseInt(match[2], 10);
  const remainder = text.substring(match[0].length).trim();
  const tokens = remainder.split(/\s+/).filter(t => t.length > 0);

  let option: string | undefined;
  let values: string[];
  // First token is an option letter if it's a single letter (A-Z)
  if (tokens.length > 0 && /^[A-Za-z]$/.test(tokens[0])) {
    option = tokens[0].toUpperCase();
    values = tokens.slice(1);
  } else {
    values = tokens;
  }

  return {
    cardType, distNumber, option, values,
    range: { startLine: line.startLine, startCol: 0, endLine: line.endLine, endCol: text.length },
  };
}

/**
 * Regex matching a data-block IMP card: IMP:particles values
 * Must have a space after the particle list (not = which is the cell-param form).
 */
const IMP_CARD_RE = /^IMP:[A-Z,]+\s/i;

export function isImpCard(text: string): boolean {
  return IMP_CARD_RE.test(text.trim());
}

export function parseImpCard(line: LogicalLine): ImpCard {
  const text = line.text.trim();
  const match = text.match(/^IMP:([A-Z,]+)\s+/i);
  if (!match) throw new Error('Invalid IMP card');
  const particles = match[1].toUpperCase().split(',').filter(p => p.length > 0);
  const remainder = text.substring(match[0].length).trim();
  const values = remainder.split(/\s+/).filter(t => t.length > 0).map(v => parseFloat(v));
  return {
    particles,
    values,
    range: { startLine: line.startLine, startCol: 0, endLine: line.endLine, endCol: text.length },
  };
}
