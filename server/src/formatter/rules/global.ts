/**
 * Global formatting rules — apply to all card types.
 *
 * Each rule mutates CST nodes in place (whitespace/indent only).
 * Rules never insert or remove content tokens.
 */

import {
	McnpCST,
	BlockNode,
	CardNode,
	BlankLineNode,
} from '../cst/types';
import { FormatterConfig } from '../config';

/** Apply all global rules to the CST based on config. */
export function applyGlobalRules(cst: McnpCST, config: FormatterConfig): void {
	if (config.trimTrailingWhitespace) {
		trimTrailingWhitespace(cst);
	}
	if (config.tabHandling === 'convert') {
		convertTabs(cst);
	}
	normalizeLineEndings(cst, config.lineEnding);
	normalizeBlankLines(cst, config.maxConsecutiveBlankLines);
	applyContinuationStyle(cst, config);
	if (config.alignInlineComments) {
		alignInlineComments(cst, config.inlineCommentColumn);
	}
}

// ─── Trim trailing whitespace ───────────────────────────────────

/** Remove trailing spaces/tabs from every physical line in every card. */
function trimTrailingWhitespace(cst: McnpCST): void {
	forEachCard(cst, card => {
		for (const line of card.lines) {
			if (line.inlineComment) {
				// Trim trailing spaces from comment text (e.g., "$ void   " → "$ void")
				line.inlineComment.text = line.inlineComment.text.trimEnd();
			} else if (line.continuationMarker !== undefined) {
				// Nothing after marker before lineEnding
			} else if (line.tokens.length > 0) {
				// Trim trailing space from last token
				line.tokens[line.tokens.length - 1].trailingSpace = '';
			} else {
				// Empty-token line (e.g., blank indent only) — clear indent trailing whitespace
				line.indent = '';
			}
		}
	});
}

// ─── Convert tabs ───────────────────────────────────────────────

/**
 * Convert tab characters to spaces using MCNP's 8-character tab stops
 * (positions 9, 17, 25, ... i.e., every 8 characters). §3.2.2 (p.225)
 */
function convertTabs(cst: McnpCST): void {
	forEachCard(cst, card => {
		for (const line of card.lines) {
			// Convert tabs in indent
			if (line.indent.includes('\t')) {
				line.indent = expandTabs(line.indent, 0);
			}

			// Convert tabs in token trailing spaces
			// We need to track column position for correct tab expansion
			let col = line.indent.length;
			for (const token of line.tokens) {
				col += token.text.length;
				if (token.trailingSpace.includes('\t')) {
					token.trailingSpace = expandTabs(token.trailingSpace, col);
					col += token.trailingSpace.length;
				} else {
					col += token.trailingSpace.length;
				}
			}
		}
	});
}

/** Expand tabs to spaces at MCNP's 8-character tab stops. */
function expandTabs(text: string, startCol: number): string {
	let result = '';
	let col = startCol;

	for (const ch of text) {
		if (ch === '\t') {
			const spacesNeeded = 8 - (col % 8);
			result += ' '.repeat(spacesNeeded);
			col += spacesNeeded;
		} else {
			result += ch;
			col++;
		}
	}

	return result;
}

// ─── Normalize line endings ─────────────────────────────────────

/** Unify all line endings to the configured style. */
function normalizeLineEndings(cst: McnpCST, style: 'lf' | 'crlf'): void {
	const ending = style === 'crlf' ? '\r\n' : '\n';

	// Title
	if (cst.title.rawText.length > 0) {
		cst.title.rawText = replaceLineEndings(cst.title.rawText, ending);
	}

	// Message block
	if (cst.messageBlock) {
		cst.messageBlock.rawText = replaceLineEndings(cst.messageBlock.rawText, ending);
	}

	// Blank line nodes
	normalizeBlankLineEndings(cst.messageDelimiter, ending);
	normalizeBlankLineEndings(cst.cellSurfaceDelimiter, ending);
	normalizeBlankLineEndings(cst.surfaceDataDelimiter, ending);
	normalizeBlankLineEndings(cst.dataTerminator, ending);

	// Blocks
	normalizeBlockLineEndings(cst.cellBlock, ending);
	normalizeBlockLineEndings(cst.surfaceBlock, ending);
	normalizeBlockLineEndings(cst.dataBlock, ending);

	// Trailing
	if (cst.trailing) {
		cst.trailing.rawText = replaceLineEndings(cst.trailing.rawText, ending);
	}
}

function normalizeBlankLineEndings(node: BlankLineNode | undefined, ending: string): void {
	if (!node) return;
	node.lines = node.lines.map(l => replaceLineEndings(l, ending));
}

function normalizeBlockLineEndings(block: BlockNode, ending: string): void {
	for (const child of block.children) {
		switch (child.type) {
			case 'card':
				for (const line of child.lines) {
					if (line.lineEnding.length > 0) {
						line.lineEnding = ending;
					}
				}
				break;
			case 'comment':
				child.lines = child.lines.map(l => replaceLineEndings(l, ending));
				break;
			case 'blank':
				child.lines = child.lines.map(l => replaceLineEndings(l, ending));
				break;
			case 'verticalFormat':
				child.rawText = replaceLineEndings(child.rawText, ending);
				break;
		}
	}
}

function replaceLineEndings(text: string, ending: string): string {
	// Normalize all line endings to \n first, then replace with target
	return text.replace(/\r\n/g, '\n').replace(/\n/g, ending);
}

// ─── Normalize blank lines ─────────────────────────────────────

/**
 * Collapse consecutive blank lines within blocks to at most
 * maxConsecutive. Never touch block delimiters.
 */
function normalizeBlankLines(cst: McnpCST, maxConsecutive: number): void {
	collapseBlankLinesInBlock(cst.cellBlock, maxConsecutive);
	collapseBlankLinesInBlock(cst.surfaceBlock, maxConsecutive);
	collapseBlankLinesInBlock(cst.dataBlock, maxConsecutive);
}

function collapseBlankLinesInBlock(block: BlockNode, max: number): void {
	for (const child of block.children) {
		if (child.type === 'blank' && child.lines.length > max) {
			child.lines = child.lines.slice(0, max);
		}
	}
}

// ─── Continuation style ────────────────────────────────────────

/**
 * Convert between continuation styles:
 * - "indent": 5-space indent, no & markers (§4.4.6)
 * - "ampersand": trailing " &", continuation data starts at col 1 (§4.4.6)
 */
function applyContinuationStyle(cst: McnpCST, config: FormatterConfig): void {
	forEachCard(cst, card => {
		if (card.lines.length <= 1) return;

		for (let i = 0; i < card.lines.length; i++) {
			const line = card.lines[i];
			const isLast = i === card.lines.length - 1;
			const nextLine = isLast ? undefined : card.lines[i + 1];

			if (config.continuationStyle === 'indent') {
				// Remove any & marker from this line.
				// Note: trimTrailingWhitespace runs before this rule, so the
				// last token's trailingSpace is already cleared. The marker's
				// leading space is discarded intentionally since trim would
				// remove it anyway.
				if (line.continuationMarker !== undefined) {
					line.continuationMarker = undefined;
				}
				// Ensure continuation lines have proper indent
				if (nextLine && nextLine.isContinuation) {
					const currentIndent = nextLine.indent.length;
					if (currentIndent < config.continuationIndent) {
						nextLine.indent = ' '.repeat(config.continuationIndent);
					}
				}
			} else {
				// Ampersand style
				// Add & marker to non-last lines that have a continuation after them
				if (!isLast && nextLine?.isContinuation) {
					if (line.continuationMarker === undefined) {
						line.continuationMarker = ' &';
					}
					// Remove indent from continuation line (ampersand style uses col 1)
					// Only strip if it was an indent-style continuation
					if (nextLine.indent.length >= config.continuationIndent && /^ +$/.test(nextLine.indent)) {
						nextLine.indent = '';
						nextLine.isContinuation = true; // Still a continuation
					}
				}
			}
		}
	});
}

// ─── Align inline comments ─────────────────────────────────────

/**
 * Align $ comments to a target column within each card.
 * Only adjusts the leadingSpace before $, never changes comment text.
 */
function alignInlineComments(cst: McnpCST, targetColumn: number): void {
	forEachCard(cst, card => {
		for (const line of card.lines) {
			if (!line.inlineComment) continue;

			// Calculate current content width (indent + tokens + marker)
			let contentWidth = line.indent.length;
			for (const token of line.tokens) {
				contentWidth += token.text.length + token.trailingSpace.length;
			}
			if (line.continuationMarker) {
				contentWidth += line.continuationMarker.length;
			}

			// Set leading space to reach target column
			const spacesNeeded = Math.max(1, targetColumn - contentWidth);
			line.inlineComment.leadingSpace = ' '.repeat(spacesNeeded);
		}
	});
}

// ─── Helpers ────────────────────────────────────────────────────

/** Visit every CardNode in the CST. */
function forEachCard(cst: McnpCST, fn: (card: CardNode) => void): void {
	forEachCardInBlock(cst.cellBlock, fn);
	forEachCardInBlock(cst.surfaceBlock, fn);
	forEachCardInBlock(cst.dataBlock, fn);
}

function forEachCardInBlock(block: BlockNode, fn: (card: CardNode) => void): void {
	for (const child of block.children) {
		if (child.type === 'card') {
			fn(child);
		}
	}
}
