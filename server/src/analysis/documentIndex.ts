import { McnpDocument, CellCard, SurfaceCard, MaterialCard, ThermalCard, TransformCard, TallyCard, TallyModifierCard, SdefCard, ModeCard, NpsCard, CtmeCard, KcodeCard, KsrcCard, SourceDistCard, ImpCard, SourceRange } from '../types';

export type BlockInfo =
  | { type: 'cell'; cell: CellCard }
  | { type: 'surface'; surface: SurfaceCard }
  | { type: 'material'; material: MaterialCard }
  | { type: 'thermal'; thermal: ThermalCard }
  | { type: 'transform'; transform: TransformCard }
  | { type: 'tally'; tally: TallyCard }
  | { type: 'tallyModifier'; tallyModifier: TallyModifierCard }
  | { type: 'sdef'; sdef: SdefCard }
  | { type: 'mode'; mode: ModeCard }
  | { type: 'nps'; nps: NpsCard }
  | { type: 'ctme'; ctme: CtmeCard }
  | { type: 'kcode'; kcode: KcodeCard }
  | { type: 'ksrc'; ksrc: KsrcCard }
  | { type: 'sourceDist'; sourceDist: SourceDistCard }
  | { type: 'imp'; imp: ImpCard };

export function getCardFromBlock(b: BlockInfo): { range: SourceRange } {
  switch (b.type) {
    case 'cell': return b.cell;
    case 'surface': return b.surface;
    case 'material': return b.material;
    case 'thermal': return b.thermal;
    case 'transform': return b.transform;
    case 'tally': return b.tally;
    case 'tallyModifier': return b.tallyModifier;
    case 'sdef': return b.sdef;
    case 'mode': return b.mode;
    case 'nps': return b.nps;
    case 'ctme': return b.ctme;
    case 'kcode': return b.kcode;
    case 'ksrc': return b.ksrc;
    case 'sourceDist': return b.sourceDist;
    case 'imp': return b.imp;
  }
}

export class DocumentIndex {
  private cellMap = new Map<number, CellCard>();
  private surfaceMap = new Map<number, SurfaceCard>();
  private materialMap = new Map<number, MaterialCard>();
  private thermalMap = new Map<number, ThermalCard>();
  private transformMap = new Map<number, TransformCard>();
  private lineIndex = new Map<number, BlockInfo>();

  // Block boundary data for gap-line section detection
  private maxCellLine: number;
  private maxSurfaceLine: number;
  private minSurfaceLine: number;

  readonly cellIds: Set<number>;
  readonly surfaceIds: Set<number>;
  readonly materialIds: Set<number>;
  readonly transformIds: Set<number>;

  constructor(doc: McnpDocument) {
    const registerLines = <T extends { range: SourceRange }>(cards: T[], build: (card: T) => BlockInfo): void => {
      for (const card of cards) {
        for (let l = card.range.startLine; l <= card.range.endLine; l++) {
          this.lineIndex.set(l, build(card));
        }
      }
    };

    // Cards with ID maps
    for (const c of doc.cells) this.cellMap.set(c.id, c);
    registerLines(doc.cells, c => ({ type: 'cell', cell: c }));
    for (const s of doc.surfaces) this.surfaceMap.set(s.id, s);
    registerLines(doc.surfaces, s => ({ type: 'surface', surface: s }));
    for (const m of doc.materials) this.materialMap.set(m.id, m);
    registerLines(doc.materials, m => ({ type: 'material', material: m }));
    for (const t of doc.thermalCards) this.thermalMap.set(t.id, t);
    registerLines(doc.thermalCards, t => ({ type: 'thermal', thermal: t }));
    for (const tr of doc.transformCards) this.transformMap.set(tr.id, tr);
    registerLines(doc.transformCards, tr => ({ type: 'transform', transform: tr }));

    // Cards without ID maps
    registerLines(doc.tallyCards, t => ({ type: 'tally', tally: t }));
    registerLines(doc.tallyModifiers, tm => ({ type: 'tallyModifier', tallyModifier: tm }));
    registerLines(doc.sdefCards, s => ({ type: 'sdef', sdef: s }));
    registerLines(doc.modeCards, m => ({ type: 'mode', mode: m }));
    registerLines(doc.npsCards, n => ({ type: 'nps', nps: n }));
    registerLines(doc.ctmeCards, c => ({ type: 'ctme', ctme: c }));
    registerLines(doc.kcodeCards, k => ({ type: 'kcode', kcode: k }));
    registerLines(doc.ksrcCards, ks => ({ type: 'ksrc', ksrc: ks }));
    registerLines(doc.sourceDistCards, sd => ({ type: 'sourceDist', sourceDist: sd }));
    registerLines(doc.impCards, imp => ({ type: 'imp', imp }));
    this.cellIds = new Set(this.cellMap.keys());
    this.surfaceIds = new Set(this.surfaceMap.keys());
    this.materialIds = new Set(this.materialMap.keys());
    this.transformIds = new Set(this.transformMap.keys());

    // Precompute block boundaries for gap-line detection
    this.maxCellLine = doc.cells.reduce((max, c) => Math.max(max, c.range.endLine), -1);
    this.maxSurfaceLine = doc.surfaces.reduce((max, s) => Math.max(max, s.range.endLine), -1);
    this.minSurfaceLine = doc.surfaces.reduce((min, s) => Math.min(min, s.range.startLine), Infinity);
  }

  getCell(id: number): CellCard | undefined { return this.cellMap.get(id); }
  getSurface(id: number): SurfaceCard | undefined { return this.surfaceMap.get(id); }
  getMaterial(id: number): MaterialCard | undefined { return this.materialMap.get(id); }
  getThermal(id: number): ThermalCard | undefined { return this.thermalMap.get(id); }
  getTransform(id: number): TransformCard | undefined { return this.transformMap.get(id); }
  getBlockForLine(line: number): BlockInfo | undefined { return this.lineIndex.get(line); }

  /**
   * Determine which MCNP block section a line belongs to.
   * Uses the line index for O(1) lookup on card lines, then falls back
   * to block boundary detection for gap lines (comments, blank lines,
   * non-material data cards like NPS).
   */
  getBlockSection(line: number): 'cell' | 'surface' | 'data' | undefined {
    const block = this.lineIndex.get(line);
    if (block) {
      if (block.type === 'cell') return 'cell';
      if (block.type === 'surface') return 'surface';
      return 'data';
    }

    if (this.maxSurfaceLine >= 0 && line > this.maxSurfaceLine + 1) {
      return 'data';
    }

    if (this.maxCellLine >= 0 && line > this.maxCellLine + 1 && this.maxSurfaceLine >= 0) {
      if (this.minSurfaceLine < Infinity && line < this.minSurfaceLine) {
        return 'surface';
      }
    }

    return undefined;
  }
}
