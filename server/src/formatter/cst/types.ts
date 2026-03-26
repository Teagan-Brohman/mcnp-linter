/**
 * Concrete Syntax Tree (CST) types for the MCNP formatter.
 *
 * The CST preserves every byte of the original input file — whitespace,
 * comments, line endings, numeric literal formats, case, and shorthand
 * notation. The invariant is: emit(parse(text)) === text.
 *
 * This is separate from the AST in types.ts which extracts semantic
 * meaning (IDs, references, values) for validation and analysis.
 */

// ─── Token kinds ────────────────────────────────────────────────

export enum TokenKind {
	/** Numeric literal: integer or float, any Fortran E-edit form */
	Number = 'number',
	/** Identifier: card name, surface mnemonic, keyword, etc. */
	Identifier = 'identifier',
	/** Boolean/geometry operator: : (union), # (complement) */
	Operator = 'operator',
	/** Parenthesis: ( or ) */
	Paren = 'paren',
	/** Equals sign in KEYWORD=value */
	Equals = 'equals',
	/** Shorthand: nR, nI, xM, nJ, nLOG, nILOG */
	Shorthand = 'shorthand',
	/** Signed surface reference in geometry: -3, +5 */
	SignedNumber = 'signedNumber',
	/** Star/plus prefix on card names: *F5, +F5 */
	Prefix = 'prefix',
	/** Anything that doesn't fit other categories */
	Other = 'other',
}

// ─── Card classification ────────────────────────────────────────

export enum CardKind {
	Cell = 'cell',
	Surface = 'surface',
	Data = 'data',
}

// ─── Leaf nodes ─────────────────────────────────────────────────

/** A single token within a physical line. */
export interface TokenNode {
	/** Exact original text, verbatim (e.g., "92235.80c", "IMP:N=1", "-3") */
	text: string;
	/** Classification of the token */
	kind: TokenKind;
	/** Whitespace after this token (spaces/tabs), empty string if none */
	trailingSpace: string;
}

/** Inline comment: the "$ ..." portion at end of a line. */
export interface InlineCommentNode {
	/** The whitespace before the $ sign */
	leadingSpace: string;
	/** The full comment text including the $ (e.g., "$ oxygen sphere") */
	text: string;
}

// ─── Physical line ──────────────────────────────────────────────

/** One physical line of input within a card. */
export interface PhysicalLineNode {
	/** Leading whitespace (spaces/tabs). 5+ spaces = continuation (§4.4.6) */
	indent: string;
	/** Whether this is a continuation line (derived from indent or prev line &) */
	isContinuation: boolean;
	/** Content tokens on this line */
	tokens: TokenNode[];
	/** " &" or " &" if line ends with ampersand continuation marker (§4.4.6) */
	continuationMarker: string | undefined;
	/** Inline comment if present (§3.2.2, §4.4.3) */
	inlineComment: InlineCommentNode | undefined;
	/** Line ending: "\n", "\r\n", or "" (last line of file) */
	lineEnding: string;
}

// ─── Block-level nodes ──────────────────────────────────────────

/** A logical card: one or more physical lines forming a single card entry. */
export interface CardNode {
	type: 'card';
	/** What block this card belongs to */
	cardKind: CardKind;
	/** Physical lines making up this card (first line + continuations) */
	lines: PhysicalLineNode[];
}

/** Consecutive full-line comment cards (c/C in columns 1–5 + blank). */
export interface CommentGroupNode {
	type: 'comment';
	/** Raw comment lines, each preserved exactly as-is including line ending */
	lines: string[];
}

/** One or more blank lines. */
export interface BlankLineNode {
	type: 'blank';
	/** Raw blank lines preserved exactly (may contain spaces/tabs + line ending) */
	lines: string[];
}

/** Vertical format block starting with # in columns 1–5 (§4.4.5.2). Opaque. */
export interface VerticalFormatNode {
	type: 'verticalFormat';
	/** Raw text of the entire vertical format block, preserved exactly */
	rawText: string;
}

/** A block of cards: cells, surfaces, or data. */
export interface BlockNode {
	type: 'block';
	/** Which block this is */
	blockKind: CardKind;
	/** Children: cards, comments, blank lines, vertical format blocks */
	children: BlockChild[];
}

export type BlockChild = CardNode | CommentGroupNode | BlankLineNode | VerticalFormatNode;

// ─── Top-level nodes ────────────────────────────────────────────

/** MESSAGE: block before the title card (§4.4.1). Opaque. */
export interface MessageBlockNode {
	type: 'messageBlock';
	/** Raw text of the entire message block, preserved exactly */
	rawText: string;
}

/** Problem title card — first line after message block (§4.4.2). Opaque. */
export interface TitleNode {
	type: 'title';
	/** Raw text of the title line including line ending */
	rawText: string;
}

/** Content after the final blank-line terminator (§4.2). Opaque. */
export interface TrailingNode {
	type: 'trailing';
	/** Raw text of everything after the data block terminator */
	rawText: string;
}

// ─── Root ───────────────────────────────────────────────────────

/** The complete lossless CST of an MCNP input file. */
export interface McnpCST {
	/** Optional MESSAGE: block */
	messageBlock: MessageBlockNode | undefined;
	/** Blank line delimiter after message block (if message block present) */
	messageDelimiter: BlankLineNode | undefined;
	/** Required problem title card */
	title: TitleNode;
	/** Cell card block */
	cellBlock: BlockNode;
	/** Blank line delimiter between cells and surfaces */
	cellSurfaceDelimiter: BlankLineNode;
	/** Surface card block */
	surfaceBlock: BlockNode;
	/** Blank line delimiter between surfaces and data */
	surfaceDataDelimiter: BlankLineNode;
	/** Data card block */
	dataBlock: BlockNode;
	/** Optional blank line terminator after data block */
	dataTerminator: BlankLineNode | undefined;
	/** Optional trailing content after terminator */
	trailing: TrailingNode | undefined;
}
