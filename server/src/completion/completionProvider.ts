import { CompletionItem, CompletionItemKind } from 'vscode-languageserver/node';
import { McnpDocument } from '../types';
import { DocumentIndex } from '../analysis/documentIndex';
import { XsdirData } from '../data/xsdirParser';
import { resolveCellAtLine, extractCardName, getTokenRange } from '../analysis/lspUtils';
import { splitLines } from '../utils/text';
import { getElement } from '../data/elements';
import { SURFACE_TALLY_TYPES, CELL_TALLY_TYPES } from '../data/tallyTypes';

/** Surface type mnemonics with descriptions for completion. */
const SURFACE_MNEMONICS: [string, string][] = [
  ['P', 'General plane'],
  ['PX', 'Plane normal to x axis'],
  ['PY', 'Plane normal to y axis'],
  ['PZ', 'Plane normal to z axis'],
  ['SO', 'Sphere centered at origin'],
  ['S', 'General sphere'],
  ['SX', 'Sphere centered on x axis'],
  ['SY', 'Sphere centered on y axis'],
  ['SZ', 'Sphere centered on z axis'],
  ['C/X', 'Cylinder parallel to x axis'],
  ['C/Y', 'Cylinder parallel to y axis'],
  ['C/Z', 'Cylinder parallel to z axis'],
  ['CX', 'Cylinder on x axis'],
  ['CY', 'Cylinder on y axis'],
  ['CZ', 'Cylinder on z axis'],
  ['K/X', 'Cone parallel to x axis'],
  ['K/Y', 'Cone parallel to y axis'],
  ['K/Z', 'Cone parallel to z axis'],
  ['KX', 'Cone on x axis'],
  ['KY', 'Cone on y axis'],
  ['KZ', 'Cone on z axis'],
  ['SQ', 'Ellipsoid/Hyperboloid/Paraboloid'],
  ['GQ', 'General quadratic'],
  ['TX', 'Torus parallel to x axis'],
  ['TY', 'Torus parallel to y axis'],
  ['TZ', 'Torus parallel to z axis'],
  ['RPP', 'Rectangular parallelepiped'],
  ['SPH', 'Sphere (macrobody)'],
  ['RCC', 'Right circular cylinder'],
  ['RHP', 'Right hexagonal prism'],
  ['HEX', 'Right hexagonal prism'],
  ['REC', 'Right elliptical cylinder'],
  ['TRC', 'Truncated right-angle cone'],
  ['ELL', 'Ellipsoid (macrobody)'],
  ['WED', 'Wedge (macrobody)'],
  ['BOX', 'Arbitrarily oriented box'],
  ['ARB', 'Arbitrary polyhedron'],
];

/** Cell parameter keywords offered in cell geometry/parameter region and after BUT. */
const CELL_PARAMETERS: [string, string][] = [
  ['IMP:N=', 'Neutron importance (0 = killed)'],
  ['IMP:P=', 'Photon importance (0 = killed)'],
  ['IMP:E=', 'Electron importance (0 = killed)'],
  ['VOL=', 'Cell volume override'],
  ['PWT=', 'Photon weight'],
  ['TMP=', 'Cell temperature (MeV)'],
  ['U=', 'Universe number assignment'],
  ['FILL=', 'Fill cell with universe'],
  ['*FILL=', 'Fill with universe (angles in degrees)'],
  ['LAT=', 'Lattice type (1=hex, 2=hex prism)'],
  ['TRCL=', 'Coordinate transformation number'],
  ['*TRCL=', 'Coordinate transformation (angles in degrees)'],
  ['COSY=', 'Coordinate system'],
  ['BFLCL=', 'B-field cell'],
  ['MAT=', 'Material number (LIKE BUT override)'],
  ['RHO=', 'Density override (LIKE BUT)'],
  ['EXT:N=', 'Neutron exponential transform'],
  ['EXT:P=', 'Photon exponential transform'],
  ['EXT:E=', 'Electron exponential transform'],
  ['FCL:N=', 'Neutron forced collision'],
  ['FCL:P=', 'Photon forced collision'],
  ['FCL:E=', 'Electron forced collision'],
  ['WWE:N=', 'Neutron weight-window energy bounds'],
  ['WWE:P=', 'Photon weight-window energy bounds'],
  ['WWE:E=', 'Electron weight-window energy bounds'],
  ['WWN:N=', 'Neutron weight-window lower bounds'],
  ['WWN:P=', 'Photon weight-window lower bounds'],
  ['WWN:E=', 'Electron weight-window lower bounds'],
  ['DXC:N=', 'Neutron DXTRAN contribution probability'],
  ['DXC:P=', 'Photon DXTRAN contribution probability'],
  ['DXC:E=', 'Electron DXTRAN contribution probability'],
  ['NONU=', 'Fission turnoff (0=on, 1=off, 2=off+no energy)'],
  ['PD=', 'Detector contribution probability'],
  ['ELPT:N=', 'Neutron energy cutoff'],
  ['ELPT:P=', 'Photon energy cutoff'],
  ['ELPT:E=', 'Electron energy cutoff'],
  ['UNC:N=', 'Neutron uncollided secondaries'],
  ['UNC:P=', 'Photon uncollided secondaries'],
  ['UNC:E=', 'Electron uncollided secondaries'],
];

/** Data card keywords offered on gap lines in the data block. */
const DATA_KEYWORDS: [string, string][] = [
  ['MODE', 'Particle transport mode (N, P, E, H)'],
  ['NPS', 'Number of particle histories'],
  ['CTME', 'Computer time cutoff (minutes)'],
  ['SDEF', 'General source definition'],
  ['KCODE', 'Criticality source parameters'],
  ['KSRC', 'Criticality source point locations'],
  ['PRINT', 'Print table control'],
  ['PRDMP', 'Print/dump cycle control'],
  ['PHYS', 'Physics options'],
  ['CUT', 'Particle cutoff options'],
  ['VOID', 'Void all materials (geometry debug)'],
  ['TOTNU', 'Use total fission neutron number'],
  ['NONU', 'Turn off fission neutron production'],
  ['RAND', 'Random number generator control'],
];

/** SDEF source definition keywords with descriptions. */
const SDEF_KEYWORDS: [string, string][] = [
  ['CEL=', 'Starting cell'],
  ['SUR=', 'Starting surface'],
  ['ERG=', 'Energy (MeV)'],
  ['TME=', 'Time (shakes)'],
  ['DIR=', 'Direction cosine (reference to VEC)'],
  ['VEC=', 'Reference vector for DIR'],
  ['NRM=', 'Surface normal sign (+1 or -1)'],
  ['POS=', 'Position (x y z)'],
  ['RAD=', 'Radial distance from AXS'],
  ['EXT=', 'Distance from POS along AXS'],
  ['AXS=', 'Axis vector (x y z)'],
  ['X=', 'X coordinate'],
  ['Y=', 'Y coordinate'],
  ['Z=', 'Z coordinate'],
  ['ARA=', 'Surface area for SUR source'],
  ['WGT=', 'Particle weight'],
  ['TR=', 'Transform number'],
  ['EFF=', 'Rejection efficiency criterion'],
  ['PAR=', 'Particle type (1=N, 2=P, 3=E, N, P, E)'],
];

/**
 * Provide context-aware completions based on cursor position in an MCNP input file.
 */
export function getCompletions(
  doc: McnpDocument,
  position: { line: number; character: number },
  text: string,
  options: { idx: DocumentIndex; xsdirData?: XsdirData }
): CompletionItem[] {
  const idx = options.idx;

  const section = idx.getBlockSection(position.line);
  if (!section) return [];

  if (section === 'cell') {
    return getCellCompletions(doc, position, text, idx);
  }
  if (section === 'surface') {
    return getSurfaceCompletions(doc, position, text, idx);
  }
  if (section === 'data') {
    return getDataCompletions(doc, idx, position, text, options.xsdirData);
  }

  return [];
}

function getCellCompletions(
  doc: McnpDocument,
  position: { line: number; character: number },
  text: string,
  idx: DocumentIndex
): CompletionItem[] {
  const cell = resolveCellAtLine(idx, doc, position.line);
  if (!cell) return [];

  const lines = splitLines(text);
  const lineText = lines[position.line] ?? '';

  // If cursor is right after KEY= in a parameter, offer only values for that keyword
  const paramValueItems = getActiveParamValueCompletions(lineText, position.character, doc, lines);
  if (paramValueItems) return paramValueItems;

  // LIKE n BUT form — detect from parsed cell OR from line text (parser needs 4 tokens,
  // but user may still be typing, e.g. "2  LIKE " with only 2-3 tokens)
  const isLikeBut = cell.likeCell !== undefined
    || (position.line === cell.range.startLine && isLikeButLine(lineText));
  if (isLikeBut) {
    if (position.line === cell.range.startLine) {
      const tok0 = getTokenRange(lineText, 0);
      if (tok0 && position.character < tok0.end) return [];
      const tok1 = getTokenRange(lineText, 1);
      // Cursor on or right after LIKE keyword — offer cell IDs for the next token
      if (tok1 && position.character <= tok1.end) return [];
      const tok2 = getTokenRange(lineText, 2);
      // Cursor at token 2 position (cell number) or between LIKE and BUT
      if (!tok2 || position.character <= tok2.end) {
        return getCellIdCompletions(doc, cell.id, lines);
      }
      const tok3 = getTokenRange(lineText, 3);
      // Cursor on BUT keyword itself — no completions
      if (tok3 && position.character < tok3.end) return [];
    }
    return getCellParameterCompletions();
  }

  // On the cell's start line, check if cursor is at the material position (token 1)
  if (position.line === cell.range.startLine) {
    const tok1 = getTokenRange(lineText, 1);
    if (tok1 && position.character >= tok1.start && position.character <= tok1.end) {
      return getMaterialCompletions(doc, text);
    }
    // If before token 1, no completions (user is typing cell number)
    const tok0 = getTokenRange(lineText, 0);
    if (tok0 && position.character <= tok0.end) {
      return [];
    }
  }

  // Geometry/parameter region: offer surfaces, cell complements, and keywords
  return [
    ...getSurfaceRefCompletions(doc),
    ...getCellComplementCompletions(doc, cell.id),
    ...getCellParameterCompletions(),
  ];
}

/**
 * When the cursor is right after KEY= (e.g. "U=|" or "MAT=|"), return value-only
 * completions for that keyword. Returns undefined if cursor is not in this context.
 */
function getActiveParamValueCompletions(
  lineText: string,
  character: number,
  doc: McnpDocument,
  lines: string[],
): CompletionItem[] | undefined {
  // Look at text before cursor for a KEY= pattern
  const before = lineText.substring(0, character);
  const paramMatch = before.match(/(\*?[A-Za-z:]+)=([^\s]*)$/);
  if (!paramMatch) return undefined;

  const keyword = paramMatch[1].toUpperCase();
  const typed = paramMatch[2]; // what user typed after =

  const items: CompletionItem[] = [];

  if (keyword === 'MAT') {
    for (const mat of doc.materials) {
      const name = extractCardName(mat.range.startLine, mat.range.endLine, lines);
      items.push({
        label: String(mat.id),
        detail: name ? `Material ${mat.id} — ${name}` : `Material ${mat.id}`,
        kind: CompletionItemKind.Value,
      });
    }
  } else if (keyword === 'U' || keyword === 'FILL' || keyword === '*FILL') {
    for (const u of getUniverseNumbers(doc)) {
      items.push({
        label: String(u),
        detail: keyword === 'U' ? `Assign to universe ${u}` : `Fill with universe ${u}`,
        kind: CompletionItemKind.Value,
      });
    }
  } else if (keyword === 'TRCL' || keyword === '*TRCL') {
    for (const tr of doc.transformCards) {
      items.push({
        label: String(tr.id),
        detail: `Transform ${tr.id}`,
        kind: CompletionItemKind.Value,
      });
    }
  } else if (keyword === 'LAT') {
    items.push({ label: '1', detail: 'Hexahedral (rectangular) lattice', kind: CompletionItemKind.Value });
    items.push({ label: '2', detail: 'Hexagonal prism lattice', kind: CompletionItemKind.Value });
  } else if (keyword === 'NONU') {
    items.push({ label: '0', detail: 'Fission neutrons produced (default)', kind: CompletionItemKind.Value });
    items.push({ label: '1', detail: 'Fission neutrons not produced', kind: CompletionItemKind.Value });
    items.push({ label: '2', detail: 'No fission neutrons, no fission energy', kind: CompletionItemKind.Value });
  } else if (keyword.startsWith('IMP:')) {
    items.push({ label: '1', detail: 'Track particle', kind: CompletionItemKind.Value });
    items.push({ label: '0', detail: 'Kill particle (void-like)', kind: CompletionItemKind.Value });
  } else {
    return undefined; // not a keyword we have values for
  }

  // Filter by what the user has already typed after =
  if (typed.length > 0) {
    return items.filter(i => i.label.startsWith(typed));
  }

  return items;
}

/** Detect LIKE BUT form from raw line text (works even before parser recognizes it). */
function isLikeButLine(lineText: string): boolean {
  const tokens = lineText.trim().split(/\s+/);
  return tokens.length >= 2 && tokens[1].toUpperCase() === 'LIKE';
}

function getCellIdCompletions(doc: McnpDocument, currentCellId: number, lines: string[]): CompletionItem[] {
  return doc.cells
    .filter(c => c.id !== currentCellId)
    .map(c => {
      const name = extractCardName(c.range.startLine, c.range.endLine, lines);
      return {
        label: String(c.id),
        detail: name ? `Cell ${c.id} — ${name}` : `Cell ${c.id}`,
        kind: CompletionItemKind.Reference,
      };
    });
}

function getMaterialCompletions(doc: McnpDocument, text: string): CompletionItem[] {
  const lines = splitLines(text);
  const items: CompletionItem[] = [];

  // Void cell (material 0)
  items.push({
    label: '0',
    detail: 'Void cell (no material)',
    kind: CompletionItemKind.Value,
  });

  for (const mat of doc.materials) {
    const name = extractCardName(mat.range.startLine, mat.range.endLine, lines);
    items.push({
      label: String(mat.id),
      detail: name ? `Material ${mat.id} — ${name}` : `Material ${mat.id}`,
      kind: CompletionItemKind.Value,
    });
  }

  return items;
}

function getSurfaceRefCompletions(doc: McnpDocument): CompletionItem[] {
  return doc.surfaces.map(s => ({
    label: String(s.id),
    detail: `Surface ${s.id} — ${s.type.toUpperCase()}`,
    kind: CompletionItemKind.Reference,
  }));
}

function getCellComplementCompletions(doc: McnpDocument, currentCellId: number): CompletionItem[] {
  return doc.cells
    .filter(c => c.id !== currentCellId)
    .map(c => ({
      label: `#${c.id}`,
      detail: `Cell ${c.id} complement`,
      kind: CompletionItemKind.Reference,
    }));
}

function getCellParameterCompletions(): CompletionItem[] {
  return CELL_PARAMETERS.map(([kw, desc]) => ({
    label: kw,
    detail: desc,
    kind: CompletionItemKind.Keyword,
    // Re-trigger completions after inserting KEY= so value suggestions appear
    command: { title: '', command: 'editor.action.triggerSuggest' },
  }));
}

/** Collect universe numbers from cell parameters when UniverseMap is unavailable. */
function getUniverseNumbers(doc: McnpDocument): number[] {
  const universes = new Set<number>();
  for (const cell of doc.cells) {
    const u = cell.parameters.get('U');
    if (u !== undefined) {
      const n = parseInt(u, 10);
      if (!isNaN(n) && n > 0) universes.add(n);
    }
    const fill = cell.parameters.get('FILL') ?? cell.parameters.get('*FILL');
    if (fill !== undefined) {
      const n = parseInt(fill, 10);
      if (!isNaN(n) && n > 0) universes.add(n);
    }
  }
  return [...universes].sort((a, b) => a - b);
}

function getSurfaceCompletions(
  _doc: McnpDocument,
  position: { line: number; character: number },
  _text: string,
  idx: DocumentIndex
): CompletionItem[] {
  const blockInfo = idx.getBlockForLine(position.line);
  if (blockInfo?.type !== 'surface') return [];

  const surf = blockInfo.surface;
  // Only offer mnemonics on the surface's start line
  if (position.line !== surf.range.startLine) return [];

  // If the surface already has a recognized type, the mnemonic is done — no more suggestions
  if (surf.type) return [];

  return SURFACE_MNEMONICS.map(([mnemonic, desc]) => ({
    label: mnemonic,
    detail: desc,
    kind: CompletionItemKind.Enum,
  }));
}

function getDataCompletions(
  doc: McnpDocument,
  idx: DocumentIndex,
  position: { line: number; character: number },
  text: string,
  xsdirData?: XsdirData
): CompletionItem[] {
  const blockInfo = idx.getBlockForLine(position.line);

  // Material card line — offer ZAID completions from xsdir
  if (blockInfo?.type === 'material' && xsdirData) {
    return getZaidCompletions(xsdirData);
  }

  // SDEF card line — offer keyword completions
  if (blockInfo?.type === 'sdef') {
    return SDEF_KEYWORDS.map(([kw, desc]) => ({
      label: kw,
      detail: desc,
      kind: CompletionItemKind.Property,
    }));
  }

  // Tally card line — offer cell or surface IDs depending on tally type
  if (blockInfo?.type === 'tally') {
    if (SURFACE_TALLY_TYPES.has(blockInfo.tally.tallyType)) {
      return doc.surfaces.map(s => ({
        label: String(s.id),
        detail: `Surface ${s.id} — ${s.type?.toUpperCase() || 'unknown'}`,
        kind: CompletionItemKind.Reference,
      }));
    }
    if (CELL_TALLY_TYPES.has(blockInfo.tally.tallyType)) {
      return doc.cells.map(c => ({
        label: String(c.id),
        detail: `Cell ${c.id}${c.materialId > 0 ? ` — M${c.materialId}` : ' — void'}`,
        kind: CompletionItemKind.Reference,
      }));
    }
    return [];
  }

  // Existing card line — no completions
  if (blockInfo) return [];

  // Gap line — check if the line itself is an SDEF card (not yet indexed)
  const lines = splitLines(text);
  const lineText = (lines[position.line] ?? '').trimStart();
  if (/^SDEF(\s|$)/i.test(lineText)) {
    return SDEF_KEYWORDS.map(([kw, desc]) => ({
      label: kw,
      detail: desc,
      kind: CompletionItemKind.Property,
    }));
  }

  // Gap line — offer data card keywords
  return DATA_KEYWORDS.map(([kw, desc]) => ({
    label: kw,
    detail: desc,
    kind: CompletionItemKind.Keyword,
  }));
}

function getZaidCompletions(xsdirData: XsdirData): CompletionItem[] {
  const items: CompletionItem[] = [];

  for (const [zaid, entries] of xsdirData.entries) {
    const z = Math.floor(parseInt(zaid, 10) / 1000);
    const a = parseInt(zaid, 10) % 1000;
    const el = getElement(z);

    for (const entry of entries) {
      const fullZaid = `${zaid}.${entry.suffix}`;
      const elName = el ? (a === 0 ? `${el.name} (nat)` : `${el.symbol}-${a}`) : zaid;
      const libInfo = entry.library ? ` [${entry.library}]` : '';

      items.push({
        label: fullZaid,
        detail: `${elName}${libInfo}`,
        kind: CompletionItemKind.Value,
      });
    }
  }

  return items;
}
