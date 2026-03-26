/**
 * Material card formatting rules.
 *
 * §5.6.1 (p.304): Material card format:
 *   Mn ZAID1 fraction1 ZAID2 fraction2 ... [keywords]
 * - ZAIDs are in ZZZAAA.nnL format (e.g., 92235.80c)
 * - Fractions are positive (atom) or negative (weight)
 */

import {
	BlockNode,
	CardNode,
	TokenNode,
} from '../cst/types';
import { FormatterConfig } from '../config';

/** Apply material card rules to the data block (materials are in data). */
export function applyMaterialRules(dataBlock: BlockNode, config: FormatterConfig): void {
	if (config.alignMaterialComponents) {
		alignMaterialComponents(dataBlock, config.materialComponentThreshold);
	}
}

// ─── Align material components ─────────────────────────────────

/**
 * Align ZAID and fraction columns in material cards.
 * If a material has more than `threshold` components, format as
 * one ZAID+fraction pair per continuation line.
 */
function alignMaterialComponents(block: BlockNode, threshold: number): void {
	for (const child of block.children) {
		if (child.type !== 'card') continue;
		if (!isMaterialCard(child)) continue;
		alignSingleMaterial(child, threshold);
	}
}

/** Check if a card is a material card (starts with M followed by digits). */
function isMaterialCard(card: CardNode): boolean {
	const firstLine = card.lines[0];
	if (!firstLine || firstLine.tokens.length === 0) return false;
	return /^[mM]\d+$/i.test(firstLine.tokens[0].text);
}

/**
 * For a single material card, align ZAID and fraction columns.
 *
 * Structure: Mn ZAID1 frac1 ZAID2 frac2 ... [NLIB=x PLIB=y ...]
 * ZAID+fraction pairs should have aligned columns.
 */
function alignSingleMaterial(card: CardNode, _threshold: number): void {
	// Collect all ZAID+fraction pairs across all lines
	const pairs: { zaidToken: TokenNode; fracToken: TokenNode }[] = [];

	for (const line of card.lines) {
		const tokens = line.tokens;
		const startIdx = line === card.lines[0] ? 1 : 0; // Skip "Mn" on first line

		for (let i = startIdx; i < tokens.length - 1; i += 2) {
			if (isZaid(tokens[i].text) && isFraction(tokens[i + 1].text)) {
				pairs.push({ zaidToken: tokens[i], fracToken: tokens[i + 1] });
			}
		}
	}

	if (pairs.length < 2) return;

	// Find max ZAID width for alignment
	const maxZaidWidth = Math.max(...pairs.map(p => p.zaidToken.text.length));

	// Align: pad ZAID trailing space so fractions line up
	for (const pair of pairs) {
		const pad = maxZaidWidth - pair.zaidToken.text.length + 1;
		pair.zaidToken.trailingSpace = ' '.repeat(pad);
	}
}

/** Check if text looks like a ZAID (ZZZAAA.nnL format). */
function isZaid(text: string): boolean {
	return /^\d+(\.\d+[a-zA-Z])?$/.test(text);
}

/** Check if text looks like a fraction (positive or negative number). */
function isFraction(text: string): boolean {
	return /^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(text);
}
