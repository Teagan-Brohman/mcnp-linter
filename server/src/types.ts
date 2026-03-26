export interface SourceRange {
  startLine: number; // 0-based
  startCol: number; // 0-based
  endLine: number;
  endCol: number;
}

export interface ParseError {
  message: string;
  range: SourceRange;
  severity: 'error' | 'warning' | 'info';
  checkNumber?: number;
  deprecated?: boolean;
}

export interface McnpDocument {
  title: string;
  messageBlock?: string;
  cells: CellCard[];
  surfaces: SurfaceCard[];
  materials: MaterialCard[];
  thermalCards: ThermalCard[];
  parameterDataCards: ParameterDataCard[];
  readCards: ReadCard[];
  tallyCards: TallyCard[];
  tallyModifiers: TallyModifierCard[];
  transformCards: TransformCard[];
  modeCards: ModeCard[];
  npsCards: NpsCard[];
  ctmeCards: CtmeCard[];
  kcodeCards: KcodeCard[];
  ksrcCards: KsrcCard[];
  sdefCards: SdefCard[];
  sourceDistCards: SourceDistCard[];
  impCards: ImpCard[];
  parseErrors: ParseError[];
  blockCount: number;
  hasBrokenBlockStructure: boolean;
  originalLines?: string[];
}

export interface CellCard {
  id: number; // Cell number j (1–99,999,999)
  materialId: number; // 0 = void
  density?: number; // Absent if void; >0 atom, <0 mass
  geometry: GeometryExpression;
  parameters: Map<string, string>; // IMP:N=1, U=2, FILL=3, etc.
  likeCell?: number; // If LIKE n BUT form
  likeCellRange?: SourceRange; // Source range of the referenced cell number
  materialIdRange?: SourceRange; // Source range of the material ID (for LIKE BUT MAT= cells)
  arrayFill?: ArrayFill;
  range: SourceRange;
  /** URI of the file this entity was parsed from (set for READ file entities). */
  sourceUri?: string;
}

export interface GeometryExpression {
  surfaceRefs: SurfaceRef[];
  cellRefs?: SurfaceRef[];  // #N cell complement references
  raw: string;
}

export interface SurfaceRef {
  id: number;
  sense: '+' | '-';
  range: SourceRange;
}

export interface SurfaceCard {
  id: number;
  type: string; // Mnemonic: PX, CZ, SO, RPP, etc.
  parameters: number[];
  transform?: number;
  modifier?: '*' | '+';
  range: SourceRange;
  /** URI of the file this entity was parsed from (set for READ file entities). */
  sourceUri?: string;
}

/** Known material card keyword names (NLIB, PLIB, PNLIB, ELIB, HLIB). */
export type MaterialKeyword = 'NLIB' | 'PLIB' | 'PNLIB' | 'ELIB' | 'HLIB';

/** Recognized MCNP cell parameter base names (before any :particle suffix). */
export type CellParameterName =
  | 'IMP' | 'VOL' | 'PWT' | 'EXT' | 'FCL' | 'WWN' | 'DXC' | 'NONU' | 'PD' | 'ELPT'
  | 'COSY' | 'BFLCL' | 'UNC' | 'FILL' | '*FILL' | 'U' | 'LAT' | 'TRCL' | '*TRCL'
  | 'TMP' | 'MAT' | 'RHO';

export interface MaterialCard {
  id: number;
  components: ZaidEntry[];
  keywords: Map<MaterialKeyword, string>;
  range: SourceRange;
  /** URI of the file this entity was parsed from (set for READ file entities). */
  sourceUri?: string;
}

export interface ZaidEntry {
  zaid: string; // Raw: "92235.80c" or "1001"
  z: number;
  a: number;
  library?: string; // "80c", "24u", etc.
  fraction: number;
  range: SourceRange;
  fractionRange?: SourceRange;
}

export interface ArrayFill {
  ranges: [number, number][];  // [[i1,i2], [j1,j2], [k1,k2]] — 1-3 dimensions
  universes: number[];          // flat array of universe numbers
}

export interface ParameterDataCard {
  keyword: string;         // 'U', 'LAT', or 'FILL'
  values: number[];        // one value per cell, in cell-block order
  range: SourceRange;
}

export interface ReadCard {
  filename: string;
  range: SourceRange;
}

export interface ThermalTableEntry {
  name: string;         // "lwtr.10t"
  identifier: string;   // "lwtr"
  suffix: string;       // "10t"
  range: SourceRange;
}

export interface ThermalCard {
  id: number;           // material number from MTn
  tables: ThermalTableEntry[];
  range: SourceRange;
  /** URI of the file this entity was parsed from (set for READ file entities). */
  sourceUri?: string;
}

export type TallyType = 1 | 2 | 4 | 5 | 6 | 7 | 8;

export interface TallyBinEntry {
  id: number;
  range: SourceRange;
}

export interface TallyBinGroup {
  entries: TallyBinEntry[];
  range: SourceRange;
}

export interface TallyChainLevel {
  cells: number[];
  cellRanges: SourceRange[];
  latticeIndices?: LatticeIndexSpec;
  universeRef?: number;
  hasTotal?: boolean;
}

export interface LatticeIndexSpec {
  dimensions: [number, number][];
  range: SourceRange;
}

export interface TallyChain {
  levels: TallyChainLevel[];
  range: SourceRange;
}

export interface TallyCard {
  tallyNumber: number;
  tallyType: TallyType;
  particles: string;
  prefix?: '*' | '+';
  bins: TallyBinGroup[];
  chains?: TallyChain[];
  hasTotal: boolean;
  range: SourceRange;
}

export type TallyModifierCardType =
  'E' | 'T' | 'C' | 'FC' | 'FM' | 'FQ' | 'FS' | 'FT' | 'TF' |
  'DE' | 'DF' | 'EM' | 'TM' | 'CM' | 'CF' | 'SF' | 'SD' |
  '*E' | '*T' | '*C' | '*FC' | '*FM' | '*FQ' | '*FS' | '*FT' | '*TF' |
  '*DE' | '*DF' | '*EM' | '*TM' | '*CM' | '*CF' | '*SF' | '*SD';

export interface TransformCard {
  id: number;           // transform number from TRn or *TRn
  range: SourceRange;
}

export interface ModeCard {
  particles: string[];   // ['N', 'P', 'E', etc.] — uppercased
  range: SourceRange;
}

export interface NpsCard {
  count: number;
  range: SourceRange;
}

export interface CtmeCard {
  minutes: number;
  range: SourceRange;
}

export interface KcodeCard {
  nsrck: number;
  rkk: number;
  ikz: number;
  kct: number;
  range: SourceRange;
}

export interface KsrcCard {
  points: [number, number, number][];
  rawValueCount: number;  // total number of numeric values (may not be divisible by 3)
  range: SourceRange;
}

/** Known SDEF keyword names used by cross-reference validation. */
export type SdefKeyword = 'CEL' | 'SUR' | 'PAR' | 'POS' | 'AXS' | 'VEC' | 'ERG' | 'RAD' | 'EXT' | 'NRM' | 'WGT' | 'TME' | 'DIR' | 'EFF' | 'TR';

export interface SdefCard {
  keywords: Map<string, string>;   // KEY → raw value string (may be "D1", "0 0 0", "7.0")
  keywordRanges: Map<string, SourceRange>; // KEY → range of the KEY=value token(s)
  range: SourceRange;
}

export interface TallyModifierCard {
  cardType: TallyModifierCardType;
  tallyNumber: number;
  values: string[];
  entityRefs?: number[];
  materialRefs?: number[];
  range: SourceRange;
}

export interface SourceDistCard {
  cardType: 'SI' | 'SP' | 'SB' | 'DS';
  distNumber: number;
  option?: string;           // H, L, S, A, V, D, etc.
  values: string[];
  range: SourceRange;
}

export interface ImpCard {
  particles: string[];   // ['N'], ['N', 'P'], etc. — uppercased
  values: number[];      // one per cell in block order
  range: SourceRange;
}
