import { CodeAction, CodeActionKind, Diagnostic, TextEdit, Position } from 'vscode-languageserver/node';
import { McnpDocument } from '../types';
import { getAbundances } from '../data/abundances';
import { describeCheck } from '../data/checkCatalog';
import { splitLines } from '../utils/text';

export function getCodeActions(
  doc: McnpDocument, diagnostics: Diagnostic[], text: string, uri: string,
  range?: { start: { line: number; character: number }; end: { line: number; character: number } }
): CodeAction[] {
  const actions: CodeAction[] = [];
  const seenMaterials = new Set<number>();
  const seenCells = new Set<number>();
  const seenSurfaces = new Set<number>();

  for (const diag of diagnostics) {
    // Try material
    const matId = extractMaterialId(diag.message);
    if (matId !== undefined && !seenMaterials.has(matId)) {
      seenMaterials.add(matId);
      const insertLine = findDataBlockEnd(doc, text);
      const stub = `M${matId}  $ TODO: define material ${matId}\n`;
      actions.push(createAction(`Create material M${matId}`, diag, uri, insertLine, stub));
      continue;
    }

    // Try cell
    const cellId = extractCellId(diag.message);
    if (cellId !== undefined && !seenCells.has(cellId)) {
      seenCells.add(cellId);
      const insertLine = findCellBlockEnd(doc);
      const stub = `${cellId}  0  imp:n=0  $ TODO: define cell ${cellId}\n`;
      actions.push(createAction(`Create cell ${cellId}`, diag, uri, insertLine, stub));
      continue;
    }

    // Try surface
    const surfId = extractSurfaceId(diag.message);
    if (surfId !== undefined && !seenSurfaces.has(surfId)) {
      seenSurfaces.add(surfId);
      const insertLine = findSurfaceBlockEnd(doc);
      const stub = `${surfId}  SO  1.0  $ TODO: define surface ${surfId}\n`;
      actions.push(createAction(`Create surface ${surfId}`, diag, uri, insertLine, stub));
      continue;
    }

    // NPS stub (check 41)
    if (diag.message.includes('No NPS or CTME card found')) {
      const insertLine = findDataBlockEnd(doc, text);
      actions.push(createAction('Add NPS 1000', diag, uri, insertLine, 'NPS 1000\n'));
      continue;
    }

    // SDEF stub (check 47)
    if (diag.message.includes('No SDEF or KCODE card found')) {
      const insertLine = findDataBlockEnd(doc, text);
      actions.push(createAction('Add SDEF ERG=1.0 POS=0 0 0', diag, uri, insertLine, 'SDEF ERG=1.0 POS=0 0 0\n'));
      continue;
    }

    // TR stub (check 39)
    const trMatch = diag.message.match(/references TR(\d+) which is not defined/);
    if (trMatch) {
      const trId = parseInt(trMatch[1], 10);
      if (!isNaN(trId)) {
        const insertLine = findDataBlockEnd(doc, text);
        const stub = `TR${trId} 0 0 0  $ TODO: define transform ${trId}\n`;
        actions.push(createAction(`Create TR${trId}`, diag, uri, insertLine, stub));
        continue;
      }
    }

    // IMP stub (check 49) — offer to add the missing IMP parameter
    const impMatch = diag.message.match(/Cell (\d+) has no IMP:([A-Z])/);
    if (impMatch) {
      const cellId = parseInt(impMatch[1], 10);
      const particle = impMatch[2];
      const cell = doc.cells.find(c => c.id === cellId);
      if (cell) {
        const lines = splitLines(text);
        const cellLine = lines[cell.range.startLine] ?? '';
        const insertCol = cellLine.trimEnd().length;
        const action = CodeAction.create(`Add IMP:${particle}=1 to cell ${cellId}`, CodeActionKind.QuickFix);
        action.diagnostics = [diag];
        action.edit = {
          changes: {
            [uri]: [TextEdit.insert(Position.create(cell.range.startLine, insertCol), ` IMP:${particle}=1`)]
          }
        };
        actions.push(action);
        continue;
      }
    }

    // Elemental ZAID expansion (check 17 on A=0 ZAIDs or check 63)
    const elementalMatch = diag.message.match(/(?:Elemental ZAID|ZAID) (\d+)(?:\.(\S+))?/);
    if (elementalMatch) {
      const zaid = elementalMatch[1];
      const z = Math.floor(parseInt(zaid, 10) / 1000);
      const a = parseInt(zaid, 10) % 1000;
      if (a === 0) {
        const suffix = elementalMatch[2];
        const abundances = getAbundances(z);
        if (abundances) {
          const expandAction = buildExpandAction(doc, diag, text, uri, z, suffix, abundances);
          if (expandAction) {
            actions.push(expandAction);
            continue;
          }
        }
      }
    }
  }

  // Silence-check quick fix — one per unique check number across the diagnostics list.
  const seenCheckNumbers = new Set<number>();
  for (const diag of diagnostics) {
    const cn = typeof diag.code === 'number' ? diag.code : undefined;
    if (cn === undefined || seenCheckNumbers.has(cn)) continue;
    seenCheckNumbers.add(cn);
    const desc = describeCheck(cn);
    const title = desc ? `Silence check #${cn} (${desc})` : `Silence check #${cn}`;
    const action = CodeAction.create(title, CodeActionKind.QuickFix);
    action.diagnostics = [diag];
    action.command = { title, command: 'mcnp.silenceCheck', arguments: [cn] };
    actions.push(action);
  }

  // Refactor: expand elemental ZAID at cursor position (no diagnostic needed)
  if (range) {
    for (const mat of doc.materials) {
      for (const entry of mat.components) {
        if (entry.a !== 0) continue;
        // Match if the cursor line overlaps the ZAID's line (start or end, for multi-line logical lines)
        const cursorLine = range.start.line;
        if (cursorLine < entry.range.startLine || cursorLine > entry.range.endLine) continue;
        if (!entry.fractionRange) continue;
        const abundances = getAbundances(entry.z);
        if (!abundances) continue;
        // Don't duplicate if quick fix already exists for this ZAID
        if (actions.some(a => a.title.includes('Expand') &&
            a.edit?.changes?.[uri]?.some(e => 'range' in e && e.range.start.line === entry.range.startLine))) continue;

        const expandedLines = buildExpandedLines(entry.z, entry.fraction, entry.library, entry.range.startCol, abundances);

        const action = CodeAction.create('Expand elemental ZAID to isotopic form', CodeActionKind.Refactor);
        // Associate with any matching diagnostics so VS Code's lightbulb links them
        const matchingDiags = diagnostics.filter(d =>
          d.range.start.line === entry.range.startLine &&
          d.message.includes(String(entry.z * 1000))
        );
        if (matchingDiags.length > 0) {
          action.diagnostics = matchingDiags;
        }
        action.edit = {
          changes: {
            [uri]: [TextEdit.replace(
              {
                start: Position.create(entry.range.startLine, entry.range.startCol),
                end: Position.create(entry.fractionRange.endLine, entry.fractionRange.endCol),
              },
              expandedLines.join('\n')
            )]
          }
        };
        actions.push(action);
      }
    }
  }

  return actions;
}

function createAction(
  title: string, diag: Diagnostic, uri: string, insertLine: number, stub: string
): CodeAction {
  const action = CodeAction.create(title, CodeActionKind.QuickFix);
  action.diagnostics = [diag];
  action.edit = {
    changes: {
      [uri]: [TextEdit.insert(Position.create(insertLine, 0), stub)]
    }
  };
  return action;
}

function extractMaterialId(message: string): number | undefined {
  // "Material N referenced in cell X is not defined"
  let match = message.match(/^Material (\d+) referenced/);
  if (match) return parseInt(match[1], 10);

  // "MT N references material MN which is not defined"
  // "FM... references material MN which is not defined"
  match = message.match(/references material M(\d+) which is not defined/);
  if (match) return parseInt(match[1], 10);

  return undefined;
}

function extractCellId(message: string): number | undefined {
  // "Cell N referenced by complement #N in cell X is not defined"
  let match = message.match(/^Cell (\d+) referenced.*is not defined/);
  if (match) return parseInt(match[1], 10);

  // "Cell N referenced in FN tally does not exist"
  match = message.match(/^Cell (\d+) referenced.*does not exist/);
  if (match) return parseInt(match[1], 10);

  // "CFN references cell N which does not exist"
  match = message.match(/references cell (\d+) which does not exist/);
  if (match) return parseInt(match[1], 10);

  // "Cell N uses LIKE M BUT — cell M is not defined"
  match = message.match(/LIKE (\d+) BUT.*is not defined/);
  if (match) return parseInt(match[1], 10);

  return undefined;
}

function extractSurfaceId(message: string): number | undefined {
  // "Surface N referenced in cell X is not defined"
  let match = message.match(/^Surface (\d+) referenced.*is not defined/);
  if (match) return parseInt(match[1], 10);

  // "Surface N referenced in FN tally does not exist"
  match = message.match(/^Surface (\d+) referenced.*does not exist/);
  if (match) return parseInt(match[1], 10);

  // "SF/FS references surface N which does not exist"
  match = message.match(/references surface (\d+) which does not exist/);
  if (match) return parseInt(match[1], 10);

  return undefined;
}

function findCellBlockEnd(doc: McnpDocument): number {
  if (doc.cells.length > 0) {
    return doc.cells.reduce((max, c) => Math.max(max, c.range.endLine), -1) + 1;
  }
  // No cells — insert at line 1 (after title)
  return 1;
}

function findSurfaceBlockEnd(doc: McnpDocument): number {
  if (doc.surfaces.length > 0) {
    return doc.surfaces.reduce((max, s) => Math.max(max, s.range.endLine), -1) + 1;
  }
  // No surfaces — insert after cell block separator
  if (doc.cells.length > 0) {
    return doc.cells.reduce((max, c) => Math.max(max, c.range.endLine), -1) + 2;
  }
  return 1;
}

function buildExpandedLines(
  z: number,
  fraction: number,
  library: string | undefined,
  startCol: number,
  abundances: { a: number; atomFraction: number; weightFraction: number }[],
): string[] {
  const isWeight = fraction < 0;
  const absFraction = Math.abs(fraction);
  const sign = isWeight ? '-' : '';
  const suffixStr = library ? `.${library}` : '';
  const indent = ' '.repeat(startCol);

  return abundances.map((iso, i) => {
    const isoZaid = `${z * 1000 + iso.a}${suffixStr}`;
    const isoFrac = isWeight ? iso.weightFraction : iso.atomFraction;
    const formatted = toSigFigs(absFraction * isoFrac, 6);
    return i === 0
      ? `${isoZaid} ${sign}${formatted}`
      : `${indent}${isoZaid} ${sign}${formatted}`;
  });
}

function buildExpandAction(
  doc: McnpDocument,
  diag: Diagnostic,
  _text: string,
  uri: string,
  z: number,
  suffix: string | undefined,
  abundances: { a: number; atomFraction: number; weightFraction: number }[],
): CodeAction | undefined {
  const entry = doc.materials.flatMap(m => m.components).find(c =>
    c.a === 0 && c.z === z && c.range.startLine === diag.range.start.line
  );
  if (!entry?.fractionRange) return undefined;

  const suffixStr = suffix ?? entry.library;
  const expandedLines = buildExpandedLines(z, entry.fraction, suffixStr, entry.range.startCol, abundances);

  const action = CodeAction.create('Expand elemental ZAID to isotopic form', CodeActionKind.QuickFix);
  action.diagnostics = [diag];
  action.edit = {
    changes: {
      [uri]: [TextEdit.replace(
        {
          start: Position.create(entry.range.startLine, entry.range.startCol),
          end: Position.create(entry.fractionRange.endLine, entry.fractionRange.endCol),
        },
        expandedLines.join('\n')
      )]
    }
  };
  return action;
}

function toSigFigs(value: number, sigFigs: number): string {
  if (value === 0) return '0';
  const d = Math.floor(Math.log10(Math.abs(value))) + 1;
  const power = sigFigs - d;
  const magnitude = Math.pow(10, power);
  const shifted = Math.round(value * magnitude);
  const result = shifted / magnitude;
  const decimalPlaces = Math.max(0, power);
  return result.toFixed(decimalPlaces);
}

function findDataBlockEnd(doc: McnpDocument, text: string): number {
  const allDataCards = [
    ...doc.materials,
    ...doc.thermalCards,
    ...doc.tallyCards,
    ...doc.tallyModifiers,
    ...doc.readCards,
    ...doc.parameterDataCards,
    ...doc.modeCards,
    ...doc.npsCards,
    ...doc.ctmeCards,
    ...doc.sdefCards,
    ...doc.sourceDistCards,
    ...doc.kcodeCards,
    ...doc.ksrcCards,
    ...doc.impCards,
    ...doc.transformCards,
  ];

  if (allDataCards.length > 0) {
    return allDataCards.reduce((max, c) => Math.max(max, c.range.endLine), -1) + 1;
  }

  // No parsed data cards — insert after the surface block separator
  // (surface block end + 2: one for the blank separator, one for the insertion line)
  if (doc.surfaces.length > 0) {
    return doc.surfaces.reduce((max, s) => Math.max(max, s.range.endLine), -1) + 2;
  }
  if (doc.cells.length > 0) {
    return doc.cells.reduce((max, c) => Math.max(max, c.range.endLine), -1) + 2;
  }

  // Truly empty document — insert at end of file
  return splitLines(text).length;
}
