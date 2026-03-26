import {
  SignatureHelp,
  SignatureInformation,
  ParameterInformation,
} from 'vscode-languageserver/node';
import { McnpDocument } from '../types';
import { DocumentIndex } from '../analysis/documentIndex';
import { splitLines } from '../utils/text';
import { getSurfaceType } from '../data/surfaceTypes';

/**
 * Provide signature help for surface card parameters.
 * Shows parameter names (e.g., xmin xmax ymin ymax zmin zmax for RPP)
 * and highlights the parameter at the cursor position.
 */
export function getSignatureHelp(
  _doc: McnpDocument,
  position: { line: number; character: number },
  text: string,
  options: { idx?: DocumentIndex } = {}
): SignatureHelp | undefined {
  const idx = options.idx;
  if (!idx) return undefined;

  // Only works in the surface block
  const section = idx.getBlockSection(position.line);
  if (section !== 'surface') return undefined;

  // Get the surface card for this line
  const blockInfo = idx.getBlockForLine(position.line);
  const surf = blockInfo?.type === 'surface' ? blockInfo.surface : undefined;
  if (!surf) return undefined;

  // Get surface type info
  const typeInfo = getSurfaceType(surf.type);
  if (!typeInfo || typeInfo.paramNames.length === 0) return undefined;

  const lines = splitLines(text);

  // Find the mnemonic token on the surface's start line to know where params begin
  const startLineText = lines[surf.range.startLine];
  if (!startLineText) return undefined;

  // Tokens on start line: [surfId, (optional transform), mnemonic, param1, param2, ...]
  const startTokens = startLineText.trim().split(/\s+/).filter(t => t.length > 0);

  // Mnemonic is at token index 1 (no transform) or 2 (with transform)
  const mnemonicIdx = surf.transform !== undefined ? 2 : 1;
  if (mnemonicIdx >= startTokens.length) return undefined;
  if (startTokens[mnemonicIdx].toUpperCase() !== surf.type.toUpperCase()) return undefined;

  // Count parameter tokens before the current cursor position
  let activeParameter = 0;

  if (position.line === surf.range.startLine) {
    // Cursor is on the start line
    // Count tokens after mnemonic up to and including the token at the cursor
    const lineText = lines[position.line];

    // Find positions of all tokens in the raw line
    const tokenPositions: { start: number; end: number; text: string }[] = [];
    const tokenRegex = /\S+/g;
    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(lineText)) !== null) {
      tokenPositions.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
    }

    // Mnemonic token position in the line matches mnemonicIdx
    const mnemonicTokenPos = mnemonicIdx;
    if (mnemonicTokenPos >= tokenPositions.length) return undefined;

    // Count param tokens: those after the mnemonic, up to cursor position
    const paramTokens = tokenPositions.slice(mnemonicTokenPos + 1);

    if (paramTokens.length === 0) {
      // Cursor is on or before the mnemonic, or right after it with no params yet
      activeParameter = 0;
    } else {
      // Determine which parameter the cursor is on
      activeParameter = 0;
      for (let i = 0; i < paramTokens.length; i++) {
        if (position.character >= paramTokens[i].start) {
          activeParameter = i;
        }
      }
      // If cursor is past the last token, advance to next parameter
      const lastParam = paramTokens[paramTokens.length - 1];
      if (position.character > lastParam.end) {
        activeParameter = paramTokens.length;
      }
    }
  } else {
    // Cursor is on a continuation line
    // Count all param tokens on lines from start to current position
    let totalParamsBefore = 0;

    // Count params on start line (all tokens after mnemonic)
    const startLineTokens = startLineText.trim().split(/\s+/).filter(t => t.length > 0);
    totalParamsBefore = startLineTokens.length - (mnemonicIdx + 1);

    // Count params on intermediate continuation lines
    for (let l = surf.range.startLine + 1; l < position.line; l++) {
      const lt = lines[l];
      if (!lt) continue;
      // Skip comment lines
      if (/^[cC][\s]/.test(lt) || /^[cC]$/.test(lt)) continue;
      // Continuation lines: tokens starting from column 5+
      const contTokens = lt.trim().split(/\s+/).filter(t => t.length > 0);
      totalParamsBefore += contTokens.length;
    }

    // Count params on current line up to cursor
    const currentLineText = lines[position.line];
    if (!currentLineText) return undefined;

    const tokenPositions: { start: number; end: number }[] = [];
    const tokenRegex = /\S+/g;
    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(currentLineText)) !== null) {
      tokenPositions.push({ start: match.index, end: match.index + match[0].length });
    }

    let currentLineParams = 0;
    for (let i = 0; i < tokenPositions.length; i++) {
      if (position.character >= tokenPositions[i].start) {
        currentLineParams = i + 1;
      }
    }
    if (tokenPositions.length > 0) {
      const lastToken = tokenPositions[tokenPositions.length - 1];
      if (position.character > lastToken.end) {
        currentLineParams = tokenPositions.length + 1;
      }
      // activeParameter is 0-based: subtract 1 if we counted at least 1
      activeParameter = totalParamsBefore + Math.max(0, currentLineParams - 1);
    } else {
      activeParameter = totalParamsBefore;
    }
  }

  // Clamp activeParameter to valid range
  activeParameter = Math.min(activeParameter, typeInfo.paramNames.length - 1);
  activeParameter = Math.max(0, activeParameter);

  // Build the signature label: "TYPE p1 p2 p3 ..."
  const label = `${typeInfo.mnemonic} ${typeInfo.paramNames.join(' ')}`;

  // Build ParameterInformation with offsets into the label
  const parameters: ParameterInformation[] = [];
  let offset = typeInfo.mnemonic.length + 1; // skip "TYPE "
  for (const name of typeInfo.paramNames) {
    parameters.push(ParameterInformation.create([offset, offset + name.length], name));
    offset += name.length + 1; // +1 for the space
  }

  const sig = SignatureInformation.create(label, typeInfo.description, ...parameters);

  return {
    signatures: [sig],
    activeSignature: 0,
    activeParameter,
  };
}
