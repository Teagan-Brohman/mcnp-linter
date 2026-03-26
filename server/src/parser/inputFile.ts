import { McnpDocument, CellCard, SurfaceCard, MaterialCard, ThermalCard, ParameterDataCard, ReadCard, TallyCard, TallyModifierCard, TransformCard, ModeCard, NpsCard, CtmeCard, KcodeCard, KsrcCard, SdefCard, SourceDistCard, ImpCard, ParseError } from '../types';
import { tokenizeInput } from './tokenizer';
import { parseCellCard } from './cellCard';
import { parseSurfaceCard } from './surfaceCard';
import { isMaterialCard, parseMaterialCard, isThermalCard, parseThermalCard, isParameterDataCard, parseParameterDataCard, isReadCard, parseReadCard, isTallyCard, parseTallyCard, isTallyModifier, parseTallyModifier, isTransformCard, parseTransformCard, isModeCard, parseModeCard, isNpsCard, parseNpsCard, isCtmeCard, parseCtmeCard, isKcodeCard, parseKcodeCard, isKsrcCard, parseKsrcCard, isSdefCard, parseSdefCard, isSourceDistCard, parseSourceDistCard, isImpCard, parseImpCard } from './dataCard';
import { splitLines } from '../utils/text';
import { KNOWN_DATA_CARDS, extractCardBaseName } from '../data/cardNames';
import { suggestMatch } from '../utils/fuzzyMatch';

type LogicalLine = { startLine: number; endLine: number; text: string };

function tryParse<T>(
  action: () => T,
  target: T[],
  label: string,
  line: LogicalLine,
  parseErrors: ParseError[]
): void {
  try {
    target.push(action());
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    parseErrors.push({
      message: `${label} parse error: ${message}`,
      range: { startLine: line.startLine, startCol: 0, endLine: line.endLine, endCol: line.text.length },
      severity: 'error',
    });
  }
}

/**
 * Top-level parser that ties the tokenizer and block parsers together.
 * Parses an MCNP input file string into a complete McnpDocument.
 */
export function parseInputFile(text: string): McnpDocument {
  const originalLines = splitLines(text);
  const normalizedText = originalLines.join('\n');
  const tokenized = tokenizeInput(normalizedText);

  const cells: CellCard[] = [];
  const surfaces: SurfaceCard[] = [];
  const materials: MaterialCard[] = [];
  const thermalCards: ThermalCard[] = [];
  const parameterDataCards: ParameterDataCard[] = [];
  const readCards: ReadCard[] = [];
  const tallyCards: TallyCard[] = [];
  const tallyModifiers: TallyModifierCard[] = [];
  const transformCards: TransformCard[] = [];
  const modeCards: ModeCard[] = [];
  const npsCards: NpsCard[] = [];
  const ctmeCards: CtmeCard[] = [];
  const kcodeCards: KcodeCard[] = [];
  const ksrcCards: KsrcCard[] = [];
  const sdefCards: SdefCard[] = [];
  const sourceDistCards: SourceDistCard[] = [];
  const impCards: ImpCard[] = [];
  const parseErrors: ParseError[] = [];

  for (const w of tokenized.warnings) {
    parseErrors.push({
      message: w.message,
      range: { startLine: w.line, startCol: 0, endLine: w.line, endCol: 0 },
      severity: w.severity ?? 'warning',
    });
  }

  for (const line of tokenized.cellLines) {
    tryParse(() => parseCellCard(line), cells, 'Cell', line, parseErrors);
  }

  for (const line of tokenized.surfaceLines) {
    tryParse(() => parseSurfaceCard(line), surfaces, 'Surface', line, parseErrors);
  }

  for (const line of tokenized.dataLines) {
    if (isReadCard(line.text)) {
      tryParse(() => parseReadCard(line), readCards, 'READ card', line, parseErrors);
      continue;
    }
    if (isParameterDataCard(line.text)) {
      tryParse(() => parseParameterDataCard(line), parameterDataCards, 'Parameter data card', line, parseErrors);
      continue;
    }
    if (isThermalCard(line.text)) {
      tryParse(() => parseThermalCard(line), thermalCards, 'Thermal card', line, parseErrors);
      continue;
    }
    if (isTallyCard(line.text)) {
      tryParse(() => parseTallyCard(line), tallyCards, 'Tally card', line, parseErrors);
      continue;
    }
    if (isSourceDistCard(line.text)) {
      tryParse(() => parseSourceDistCard(line), sourceDistCards, 'Source distribution card', line, parseErrors);
      continue;
    }
    if (isTallyModifier(line.text)) {
      tryParse(() => parseTallyModifier(line), tallyModifiers, 'Tally modifier', line, parseErrors);
      continue;
    }
    if (isTransformCard(line.text)) {
      tryParse(() => parseTransformCard(line), transformCards, 'Transform card', line, parseErrors);
      continue;
    }
    if (isModeCard(line.text)) {
      tryParse(() => parseModeCard(line), modeCards, 'MODE card', line, parseErrors);
      continue;
    }
    if (isNpsCard(line.text)) {
      tryParse(() => parseNpsCard(line), npsCards, 'NPS card', line, parseErrors);
      continue;
    }
    if (isCtmeCard(line.text)) {
      tryParse(() => parseCtmeCard(line), ctmeCards, 'CTME card', line, parseErrors);
      continue;
    }
    if (isKcodeCard(line.text)) {
      tryParse(() => parseKcodeCard(line), kcodeCards, 'KCODE card', line, parseErrors);
      continue;
    }
    if (isKsrcCard(line.text)) {
      tryParse(() => parseKsrcCard(line), ksrcCards, 'KSRC card', line, parseErrors);
      continue;
    }
    if (isImpCard(line.text)) {
      tryParse(() => parseImpCard(line), impCards, 'IMP card', line, parseErrors);
      continue;
    }
    if (isSdefCard(line.text)) {
      tryParse(() => parseSdefCard(line), sdefCards, 'SDEF card', line, parseErrors);
      continue;
    }
    if (!isMaterialCard(line.text)) {
      // Check 65: flag unrecognized data cards (silently skip known-but-unparsed cards)
      const baseName = extractCardBaseName(line.text);
      if (baseName && !KNOWN_DATA_CARDS.has(baseName)) {
        const suggestion = suggestMatch(baseName, KNOWN_DATA_CARDS);
        const hint = suggestion ? ` — did you mean '${suggestion}'?` : '';
        parseErrors.push({
          message: `Unrecognized data card '${baseName}'${hint}`,
          range: { startLine: line.startLine, startCol: 0, endLine: line.endLine, endCol: line.text.length },
          severity: 'warning',
          checkNumber: 65,
        });
      }
      continue;
    }
    tryParse(() => parseMaterialCard(line), materials, 'Material', line, parseErrors);
  }

  return {
    title: tokenized.title,
    messageBlock: tokenized.messageBlock,
    cells,
    surfaces,
    materials,
    thermalCards,
    parameterDataCards,
    readCards,
    tallyCards,
    tallyModifiers,
    transformCards,
    modeCards,
    npsCards,
    ctmeCards,
    kcodeCards,
    ksrcCards,
    sdefCards,
    sourceDistCards,
    impCards,
    parseErrors,
    blockCount: tokenized.blockCount,
    hasBrokenBlockStructure: tokenized.hasBrokenBlockStructure,
    originalLines,
  };
}
