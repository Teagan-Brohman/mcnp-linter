/**
 * Cell card formatting rules.
 *
 * §3.2.3 (p.226), §5.2 (p.257): Cell card format:
 *   cell# mat# density geometry [KEYWORD=value ...]
 * - Void cells have mat=0 and no density
 * - Geometry uses signed surface numbers, : (union), # (complement), parens
 */

import {
	BlockNode,
	CardNode,
	PhysicalLineNode,
	TokenNode,
} from '../cst/types';
import { FormatterConfig } from '../config';
import { getConsecutiveCardRuns } from './shared';

/** Apply cell card rules to the cell block. */
export function applyCellRules(cellBlock: BlockNode, config: FormatterConfig): void {
	if (config.alignCellColumns) {
		alignCellColumns(cellBlock);
	}
	if (config.normalizeGeometrySpacing) {
		normalizeGeometrySpacing(cellBlock);
	}
}

// ─── Align cell columns ────────────────────────────────────────

/**
 * Align consecutive cell cards into visual columns:
 * cell ID | material ID | density | geometry start
 *
 * Operates on runs of consecutive cell cards (comment groups break the run).
 */
function alignCellColumns(block: BlockNode): void {
	const runs = getConsecutiveCardRuns(block);

	for (const run of runs) {
		alignCellRun(run);
	}
}

/** A parsed cell card's first-line structure for alignment purposes. */
interface CellLineInfo {
	card: CardNode;
	firstLine: PhysicalLineNode;
	cellIdWidth: number;
	matIdWidth: number;
	densityWidth: number;
	geometryStartIdx: number; // token index where geometry starts
	paramStartIdx: number;   // token index where parameters start (-1 if none)
}

/**
 * Parse the structure of a cell card's first line to identify
 * which tokens are cell ID, material ID, density, geometry, and parameters.
 */
function parseCellLineStructure(card: CardNode): CellLineInfo | undefined {
	const firstLine = card.lines[0];
	if (!firstLine || firstLine.tokens.length < 2) return undefined;

	const tokens = firstLine.tokens;
	let idx = 0;

	// Token 0: cell ID
	const cellIdWidth = tokens[idx].text.length;
	idx++;

	// Token 1: material ID (or "LIKE" for LIKE BUT cards)
	if (idx >= tokens.length) return undefined;
	if (tokens[idx].text.toUpperCase() === 'LIKE') {
		// LIKE BUT cards — don't try to align these
		return undefined;
	}
	const matIdWidth = tokens[idx].text.length;
	const isVoid = tokens[idx].text === '0';
	idx++;

	// Token 2: density (absent for void cells)
	let densityWidth = 0;
	if (!isVoid && idx < tokens.length) {
		densityWidth = tokens[idx].text.length;
		idx++;
	}

	const geometryStartIdx = idx;

	// Find where parameters start (first KEYWORD=value or KEYWORD:particle pattern)
	let paramStartIdx = -1;
	for (let i = geometryStartIdx; i < tokens.length; i++) {
		if (isParameterToken(tokens, i)) {
			paramStartIdx = i;
			break;
		}
	}

	return {
		card,
		firstLine,
		cellIdWidth,
		matIdWidth,
		densityWidth,
		geometryStartIdx,
		paramStartIdx,
	};
}

/** Check if a token at index i starts a parameter (KEYWORD=value or IMP:N etc.) */
function isParameterToken(tokens: TokenNode[], i: number): boolean {
	const text = tokens[i].text;
	// Patterns like IMP:N=1, VOL=100, TMP=2.53e-8, FILL=1, U=1, LAT=1
	if (text.includes('=')) return true;
	// IMP:N, IMP:P pattern (keyword with colon but no equals — value follows)
	if (/^[a-zA-Z]+:[a-zA-Z]/.test(text)) return true;
	return false;
}

/** Align a run of consecutive cell cards. */
function alignCellRun(cards: CardNode[]): void {
	const infos: CellLineInfo[] = [];
	for (const card of cards) {
		const info = parseCellLineStructure(card);
		if (info) infos.push(info);
	}

	if (infos.length < 2) return;

	// Find max widths for alignment
	const maxCellId = Math.max(...infos.map(i => i.cellIdWidth));
	const maxMatId = Math.max(...infos.map(i => i.matIdWidth));
	const maxDensity = Math.max(...infos.map(i => i.densityWidth));

	// Apply alignment by adjusting trailing spaces on the column tokens
	for (const info of infos) {
		const tokens = info.firstLine.tokens;
		let idx = 0;

		// Cell ID — pad to align material column
		const cellIdPad = maxCellId - info.cellIdWidth + 1; // +1 for minimum one space
		tokens[idx].trailingSpace = ' '.repeat(cellIdPad);
		idx++;

		// Material ID — pad to align density column
		const matIdPad = maxMatId - info.matIdWidth + 1;
		tokens[idx].trailingSpace = ' '.repeat(matIdPad);
		idx++;

		// Density (if present)
		if (info.densityWidth > 0) {
			const densityPad = maxDensity - info.densityWidth + 1;
			tokens[idx].trailingSpace = ' '.repeat(densityPad);
			idx++;
		} else if (maxDensity > 0) {
			// Void cell but other cells have density — add extra padding
			// to skip the density column
			const currentPad = tokens[idx - 1].trailingSpace.length;
			tokens[idx - 1].trailingSpace = ' '.repeat(currentPad + maxDensity);
		}
	}
}

// ─── Normalize geometry spacing ────────────────────────────────

/**
 * Normalize whitespace in geometry expressions:
 * - Single space between geometry tokens
 * - Normalize space around : (union) and # (complement)
 * - Preserve parenthesis grouping
 * - Respect user's line breaks (don't reflow across continuation lines)
 *
 * §3.2.1 (p.224): space=intersection, :=union, #=complement
 */
function normalizeGeometrySpacing(block: BlockNode): void {
	for (const child of block.children) {
		if (child.type !== 'card') continue;

		const info = parseCellLineStructure(child);
		if (!info) continue;

		// Normalize spacing on each physical line independently
		// (respects user's line breaks per design decision)
		for (const line of child.lines) {
			normalizeLineGeometrySpacing(line, info);
		}
	}
}

/**
 * Normalize geometry token spacing on a single physical line.
 * Only affects tokens in the geometry portion (before parameters).
 */
function normalizeLineGeometrySpacing(
	line: PhysicalLineNode,
	info: CellLineInfo,
): void {
	const tokens = line.tokens;
	if (tokens.length === 0) return;

	// For the first line, geometry starts after cell#/mat#/density
	// For continuation lines, all tokens are geometry (or parameters)
	const startIdx = line === info.firstLine ? info.geometryStartIdx : 0;
	const endIdx = line === info.firstLine && info.paramStartIdx >= 0
		? info.paramStartIdx
		: tokens.length;

	for (let i = startIdx; i < endIdx; i++) {
		const isLast = i === tokens.length - 1;
		if (isLast) continue; // Don't touch last token's trailing space

		// Set single space between geometry tokens
		if (tokens[i].trailingSpace.length !== 1) {
			tokens[i].trailingSpace = ' ';
		}
	}
}

// ─── Helpers ────────────────────────────────────────────────────

/** Get runs of consecutive CardNodes (broken by comments, blanks, etc.) */
