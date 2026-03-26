/**
 * CST Parser: raw MCNP input text → lossless McnpCST.
 *
 * The parser preserves every byte of the original input. The invariant
 * emit(parse(text)) === text must hold for all valid and invalid inputs.
 *
 * Manual references: MCNP6.3 Theory & User Manual, LA-UR-22-30006, Rev. 1
 * - §3.2.2 (p.225): input file format, 128-column limit, $, tabs
 * - §4.4.1 (p.247): message block
 * - §4.4.2 (p.248): title card
 * - §4.4.3 (p.248): comment cards (c in cols 1–5 + blank)
 * - §4.4.5.2 (p.250): vertical format (# in cols 1–5)
 * - §4.4.6 (p.252): continuation lines (5-space indent or trailing &)
 */

import {
	McnpCST,
	BlockNode,
	BlockChild,
	CardNode,
	CardKind,
	CommentGroupNode,
	BlankLineNode,
	PhysicalLineNode,
	TokenNode,
	TokenKind,
	InlineCommentNode,
	MessageBlockNode,
	TitleNode,
	TrailingNode,
	VerticalFormatNode,
} from './types';

/** Parse raw MCNP input text into a lossless CST. */
export function parse(text: string): McnpCST {
	const lines = splitPhysicalLines(text);
	const ctx = new ParseContext(lines);

	// Step 1: Optional message block (§4.4.1)
	const messageBlock = ctx.parseMessageBlock();
	const messageDelimiter = messageBlock ? ctx.parseBlankLines() : undefined;

	// Step 2: Title card (§4.4.2)
	const title = ctx.parseTitleCard();

	// Step 3: Cell block
	const cellBlock = ctx.parseBlock(CardKind.Cell);

	// Step 4: Blank line delimiter between cells and surfaces
	const cellSurfaceDelimiter = ctx.parseBlankLines() ?? makeEmptyBlankLine();

	// Step 5: Surface block
	const surfaceBlock = ctx.parseBlock(CardKind.Surface);

	// Step 6: Blank line delimiter between surfaces and data
	const surfaceDataDelimiter = ctx.parseBlankLines() ?? makeEmptyBlankLine();

	// Step 7: Data block
	const dataBlock = ctx.parseBlock(CardKind.Data);

	// Step 8: Optional terminator blank line + trailing content
	const dataTerminator = ctx.parseBlankLines();
	const trailing = ctx.parseTrailing();

	return {
		messageBlock,
		messageDelimiter,
		title,
		cellBlock,
		cellSurfaceDelimiter,
		surfaceBlock,
		surfaceDataDelimiter,
		dataBlock,
		dataTerminator,
		trailing,
	};
}

// ─── Line splitting ─────────────────────────────────────────────

/**
 * Split text into physical lines, preserving line endings on each line.
 * Each line includes its terminating \n or \r\n. The last line may have
 * no line ending if the file doesn't end with a newline.
 */
function splitPhysicalLines(text: string): string[] {
	if (text === '') return [];

	const result: string[] = [];
	let start = 0;

	for (let i = 0; i < text.length; i++) {
		if (text[i] === '\n') {
			result.push(text.substring(start, i + 1));
			start = i + 1;
		}
	}

	// Last line (no trailing newline)
	if (start < text.length) {
		result.push(text.substring(start));
	}

	return result;
}

/** Get the line content without the line ending. */
function stripLineEnding(line: string): string {
	if (line.endsWith('\r\n')) return line.slice(0, -2);
	if (line.endsWith('\n')) return line.slice(0, -1);
	return line;
}

/** Get the line ending from a line. */
function getLineEnding(line: string): string {
	if (line.endsWith('\r\n')) return '\r\n';
	if (line.endsWith('\n')) return '\n';
	return '';
}

// ─── Line classification ────────────────────────────────────────

/**
 * Full-line comment: c/C anywhere in columns 1–5 followed by blank (§4.4.3).
 * "Comment cards must have a c somewhere in columns 1–5 followed by at least one space."
 */
function isCommentLine(content: string): boolean {
	if (content.length === 0) return false;
	// Check columns 1–5 (indices 0–4) for 'c' or 'C'
	const checkLen = Math.min(content.length, 5);
	for (let i = 0; i < checkLen; i++) {
		if (content[i].toLowerCase() === 'c') {
			// Must be followed by a blank, or be at end of line
			if (i + 1 >= content.length) return true;
			if (content[i + 1] === ' ' || content[i + 1] === '\t') {
				// Characters before the 'c' must be blanks (can't have data before comment marker)
				let allBlanksBefore = true;
				for (let j = 0; j < i; j++) {
					if (content[j] !== ' ' && content[j] !== '\t') {
						allBlanksBefore = false;
						break;
					}
				}
				if (allBlanksBefore) return true;
			}
		}
	}
	return false;
}

/** Blank line: empty or only whitespace */
function isBlankLine(content: string): boolean {
	return content.trim().length === 0;
}

/** Continuation by 5-space indent (§4.4.6) */
function isContinuationByIndent(content: string): boolean {
	if (content.length < 5) return false;
	for (let i = 0; i < 5; i++) {
		if (content[i] !== ' ') return false;
	}
	return true;
}

/** Vertical format: # in columns 1–5 (§4.4.5.2) */
function isVerticalFormatStart(content: string): boolean {
	const trimmed = content.trimStart();
	if (!trimmed.startsWith('#')) return false;
	// # must be somewhere in columns 1–5 (0-based: 0–4)
	const hashIdx = content.indexOf('#');
	return hashIdx >= 0 && hashIdx < 5;
}

/** Message block: starts with MESSAGE: (§4.4.1) */
function isMessageBlockStart(content: string): boolean {
	return content.toLowerCase().startsWith('message:');
}

/** TMESH block start (§4.4.3: no comments or $ allowed inside) */
function isTmeshStart(content: string): boolean {
	return /^tmesh\b/i.test(content.trim());
}

/** ENDMD terminates a TMESH block */
function isEndmd(content: string): boolean {
	return /^endmd\b/i.test(content.trim());
}

// ─── Parse context ──────────────────────────────────────────────

class ParseContext {
	private lines: string[];
	private pos: number = 0;

	constructor(lines: string[]) {
		this.lines = lines;
	}

	private atEnd(): boolean {
		return this.pos >= this.lines.length;
	}

	private peek(): string {
		return this.lines[this.pos];
	}

	private advance(): string {
		return this.lines[this.pos++];
	}

	private peekContent(): string {
		return stripLineEnding(this.peek());
	}

	// ─── Top-level parsing ────────────────────────────────────

	parseMessageBlock(): MessageBlockNode | undefined {
		if (this.atEnd()) return undefined;
		const content = this.peekContent();
		if (!isMessageBlockStart(content)) return undefined;

		const parts: string[] = [];
		while (!this.atEnd()) {
			const lineContent = this.peekContent();
			if (isBlankLine(lineContent)) break;
			parts.push(this.advance());
		}

		return { type: 'messageBlock', rawText: parts.join('') };
	}

	parseTitleCard(): TitleNode {
		if (this.atEnd()) {
			return { type: 'title', rawText: '' };
		}
		return { type: 'title', rawText: this.advance() };
	}

	parseBlankLines(): BlankLineNode | undefined {
		if (this.atEnd()) return undefined;
		const content = this.peekContent();
		if (!isBlankLine(content)) return undefined;

		const lines: string[] = [];
		while (!this.atEnd() && isBlankLine(this.peekContent())) {
			lines.push(this.advance());
		}

		return { type: 'blank', lines };
	}

	parseTrailing(): TrailingNode | undefined {
		if (this.atEnd()) return undefined;

		const parts: string[] = [];
		while (!this.atEnd()) {
			parts.push(this.advance());
		}

		return { type: 'trailing', rawText: parts.join('') };
	}

	// ─── Block parsing ────────────────────────────────────────

	parseBlock(kind: CardKind): BlockNode {
		const children: BlockChild[] = [];

		while (!this.atEnd()) {
			const content = this.peekContent();

			// Blank line = end of this block
			if (isBlankLine(content)) break;

			// Vertical format block (# in cols 1–5)
			if (isVerticalFormatStart(content)) {
				children.push(this.parseVerticalFormat());
				continue;
			}

			// TMESH block: opaque from TMESH to ENDMD (§4.4.3: no $ or comments inside)
			if (isTmeshStart(content)) {
				children.push(this.parseTmeshBlock());
				continue;
			}

			// Full-line comment
			if (isCommentLine(content)) {
				children.push(this.parseCommentGroup());
				continue;
			}

			// Regular card
			children.push(this.parseCard(kind));
		}

		return { type: 'block', blockKind: kind, children };
	}

	private parseCommentGroup(): CommentGroupNode {
		const lines: string[] = [];

		while (!this.atEnd()) {
			const content = this.peekContent();
			if (!isCommentLine(content)) break;
			lines.push(this.advance());
		}

		return { type: 'comment', lines };
	}

	private parseVerticalFormat(): VerticalFormatNode {
		// The # line plus all following data lines until we hit a blank line,
		// a new card (non-continuation, non-comment), or end of block.
		// Per §4.4.5.2, the vertical format includes the # line and all
		// subsequent data lines (which are continuation-style).
		const parts: string[] = [];

		// First line (the # line)
		parts.push(this.advance());

		// Subsequent lines: continuation lines or data lines that are part
		// of this vertical format block
		while (!this.atEnd()) {
			const content = this.peekContent();
			if (isBlankLine(content)) break;
			if (isCommentLine(content)) break;
			// If not a continuation line and doesn't start with a space,
			// it's a new card — stop
			if (!isContinuationByIndent(content) && content.length > 0 && content[0] !== ' ') break;
			parts.push(this.advance());
		}

		return { type: 'verticalFormat', rawText: parts.join('') };
	}

	private parseTmeshBlock(): VerticalFormatNode {
		// TMESH...ENDMD is treated as opaque (§4.4.3: no $ or comments inside).
		// Consume all lines from TMESH through ENDMD inclusive.
		const parts: string[] = [];
		parts.push(this.advance()); // TMESH line

		while (!this.atEnd()) {
			const content = this.peekContent();
			parts.push(this.advance());
			if (isEndmd(content)) break;
			// Also stop at blank line (end of block) to avoid consuming
			// beyond the data block if ENDMD is missing
			if (isBlankLine(content)) break;
		}

		return { type: 'verticalFormat', rawText: parts.join('') };
	}

	private parseCard(kind: CardKind): CardNode {
		const physicalLines: PhysicalLineNode[] = [];

		// First line of card
		const firstRawLine = this.advance();
		const firstLine = this.parsePhysicalLine(firstRawLine, false);
		physicalLines.push(firstLine);

		// Check if first line has ampersand continuation
		let prevHadAmpersand = firstLine.continuationMarker !== undefined;

		// Gather continuation lines
		while (!this.atEnd()) {
			const content = this.peekContent();

			// Blank line = end of block, not a continuation
			if (isBlankLine(content)) break;

			// Comment lines between continuations: they belong to the
			// comment group, not to this card. But we need to handle
			// the case where comments appear within a continued card.
			// For CST purposes, we break the card at the comment and
			// let the comment be a separate node.
			if (isCommentLine(content)) {
				// Comments within a continued card break the card; the comment
				// becomes its own CommentGroupNode.
				break;
			}

			// Vertical format start = new thing, not a continuation
			if (isVerticalFormatStart(content)) break;

			// Is this a continuation line?
			const isCont = prevHadAmpersand || isContinuationByIndent(content);
			if (!isCont) break;

			const rawLine = this.advance();
			const physLine = this.parsePhysicalLine(rawLine, true);
			physicalLines.push(physLine);

			prevHadAmpersand = physLine.continuationMarker !== undefined;
		}

		return { type: 'card', cardKind: kind, lines: physicalLines };
	}

	// ─── Physical line parsing ────────────────────────────────

	private parsePhysicalLine(rawLine: string, isContinuation: boolean): PhysicalLineNode {
		const lineEnding = getLineEnding(rawLine);
		const content = stripLineEnding(rawLine);

		// Extract indent
		let indentEnd = 0;
		while (indentEnd < content.length && (content[indentEnd] === ' ' || content[indentEnd] === '\t')) {
			indentEnd++;
		}
		const indent = content.substring(0, indentEnd);

		// Extract inline comment
		let inlineComment: InlineCommentNode | undefined;
		let dataContent = content.substring(indentEnd);

		const dollarIdx = dataContent.indexOf('$');
		if (dollarIdx >= 0) {
			const beforeDollar = dataContent.substring(0, dollarIdx);
			const commentText = dataContent.substring(dollarIdx);

			// Find leading space before $
			let leadingSpaceStart = beforeDollar.length;
			while (leadingSpaceStart > 0 && (beforeDollar[leadingSpaceStart - 1] === ' ' || beforeDollar[leadingSpaceStart - 1] === '\t')) {
				leadingSpaceStart--;
			}

			inlineComment = {
				leadingSpace: beforeDollar.substring(leadingSpaceStart),
				text: commentText,
			};

			dataContent = beforeDollar.substring(0, leadingSpaceStart);
		}

		// Extract continuation marker (&)
		let continuationMarker: string | undefined;
		const trimmedData = dataContent.trimEnd();
		if (trimmedData.endsWith('&')) {
			// Find where the & is and capture it with its preceding space
			const ampIdx = trimmedData.length - 1;
			if (ampIdx > 0 && (trimmedData[ampIdx - 1] === ' ' || trimmedData[ampIdx - 1] === '\t')) {
				// Include trailing whitespace between content and & marker
				const contentEnd = trimmedData.lastIndexOf('&');
				// The marker includes the space(s) before & and any whitespace after
				// We need to find where the last real token ends
				let markerStart = contentEnd;
				while (markerStart > 0 && (trimmedData[markerStart - 1] === ' ' || trimmedData[markerStart - 1] === '\t')) {
					markerStart--;
				}
				continuationMarker = dataContent.substring(markerStart);
				dataContent = dataContent.substring(0, markerStart);
			} else if (ampIdx === 0) {
				// Just & with nothing before — unusual but handle it
				continuationMarker = dataContent;
				dataContent = '';
			}
			// If no space before &, it's part of a token (not a continuation marker)
		}

		// Tokenize the data content
		const tokens = tokenizeLine(dataContent);

		return {
			indent,
			isContinuation,
			tokens,
			continuationMarker,
			inlineComment,
			lineEnding,
		};
	}
}

// ─── Line tokenizer ─────────────────────────────────────────────

/**
 * Tokenize a line's data content (after indent, before inline comment
 * and continuation marker) into tokens with their trailing whitespace.
 */
function tokenizeLine(content: string): TokenNode[] {
	if (content.length === 0) return [];

	const tokens: TokenNode[] = [];
	let pos = 0;

	while (pos < content.length) {
		// Skip leading whitespace (should only happen at start if any)
		// But whitespace between tokens is captured as trailingSpace of the previous token

		// Find the start of next token
		const tokenStart = pos;

		// Collect non-whitespace characters as token text
		while (pos < content.length && content[pos] !== ' ' && content[pos] !== '\t') {
			pos++;
		}

		if (pos === tokenStart) {
			// We're at whitespace — this shouldn't happen if called correctly
			// but handle gracefully: skip whitespace
			pos++;
			continue;
		}

		const text = content.substring(tokenStart, pos);

		// Collect trailing whitespace
		const wsStart = pos;
		while (pos < content.length && (content[pos] === ' ' || content[pos] === '\t')) {
			pos++;
		}
		const trailingSpace = content.substring(wsStart, pos);

		const kind = classifyToken(text);
		tokens.push({ text, kind, trailingSpace });
	}

	return tokens;
}

/** Classify a token by its text content. */
function classifyToken(text: string): TokenKind {
	if (text === '(' || text === ')') return TokenKind.Paren;
	if (text === '=') return TokenKind.Equals;
	if (text === ':') return TokenKind.Operator;
	if (text === '#') return TokenKind.Operator;
	if (text === '*' || text === '+') return TokenKind.Prefix;

	// Shorthand: nR, nI, xM, nJ, nLOG, nILOG (case-insensitive)
	if (/^\d*[rRiIjJ]$/i.test(text)) return TokenKind.Shorthand;
	if (/^\d*(\.\d*)?([eE][+-]?\d+)?[mM]$/i.test(text)) return TokenKind.Shorthand;
	if (/^\d+(i?log)$/i.test(text)) return TokenKind.Shorthand;

	// Signed number (surface reference in geometry): -3, +5
	// Must check before general Number to get the specific classification
	if (/^[+-]\d+$/.test(text)) return TokenKind.SignedNumber;

	// Number: integer, float, scientific notation, signed
	if (/^[+-]?\d+(\.\d*)?([eE][+-]?\d+)?$/.test(text)) return TokenKind.Number;
	if (/^[+-]?\.\d+([eE][+-]?\d+)?$/.test(text)) return TokenKind.Number;

	return TokenKind.Identifier;
}

// ─── Helpers ────────────────────────────────────────────────────

function makeEmptyBlankLine(): BlankLineNode {
	return { type: 'blank', lines: [] };
}
