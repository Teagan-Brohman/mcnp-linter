/**
 * Surface card formatting rules.
 *
 * §3.2.4 (p.227), §5.3 (p.259): Surface card format:
 *   surface# [transform#] mnemonic parameters...
 * - Optional * prefix for reflective surfaces
 * - Optional + prefix for white-boundary surfaces
 * - Surface number must begin in columns 1–5
 */

import {
	BlockNode,
	CardNode,
} from '../cst/types';
import { FormatterConfig } from '../config';
import { getConsecutiveCardRuns } from './shared';

/** Apply surface card rules to the surface block. */
export function applySurfaceRules(surfaceBlock: BlockNode, config: FormatterConfig): void {
	if (config.alignSurfaceColumns) {
		alignSurfaceColumns(surfaceBlock);
	}
	if (config.alignSurfaceParameters) {
		alignSurfaceParameters(surfaceBlock);
	}
}

// ─── Align surface columns ─────────────────────────────────────

/**
 * Align consecutive surface cards into visual columns:
 * surface# | [transform#] | mnemonic | parameters
 */
function alignSurfaceColumns(block: BlockNode): void {
	const runs = getConsecutiveCardRuns(block);
	for (const run of runs) {
		alignSurfaceRun(run);
	}
}

interface SurfaceLineInfo {
	card: CardNode;
	surfaceIdWidth: number;
	hasTransform: boolean;
	transformWidth: number;
	mnemonicIdx: number;
	mnemonicWidth: number;
}

/**
 * Parse surface card structure. Surface cards have:
 * - Token 0: surface number (possibly with * or + prefix as part of the token)
 * - Token 1: either transform number or surface mnemonic
 * - Token 2+: if transform present, mnemonic then params; else params
 */
function parseSurfaceStructure(card: CardNode): SurfaceLineInfo | undefined {
	const firstLine = card.lines[0];
	if (!firstLine || firstLine.tokens.length < 2) return undefined;

	const tokens = firstLine.tokens;
	const surfaceIdWidth = tokens[0].text.length;

	// Is token 1 a number (transform) or a mnemonic (letters)?
	const token1 = tokens[1].text;
	const isTransform = /^\d+$/.test(token1);

	if (isTransform && tokens.length >= 3) {
		return {
			card,
			surfaceIdWidth,
			hasTransform: true,
			transformWidth: token1.length,
			mnemonicIdx: 2,
			mnemonicWidth: tokens[2].text.length,
		};
	}

	return {
		card,
		surfaceIdWidth,
		hasTransform: false,
		transformWidth: 0,
		mnemonicIdx: 1,
		mnemonicWidth: token1.length,
	};
}

function alignSurfaceRun(cards: CardNode[]): void {
	const infos: SurfaceLineInfo[] = [];
	for (const card of cards) {
		const info = parseSurfaceStructure(card);
		if (info) infos.push(info);
	}

	if (infos.length < 2) return;

	const maxSurfaceId = Math.max(...infos.map(i => i.surfaceIdWidth));
	const anyHasTransform = infos.some(i => i.hasTransform);
	const maxTransform = anyHasTransform ? Math.max(...infos.map(i => i.transformWidth)) : 0;
	const maxMnemonic = Math.max(...infos.map(i => i.mnemonicWidth));

	for (const info of infos) {
		const tokens = info.card.lines[0].tokens;
		let idx = 0;

		// Surface ID padding
		tokens[idx].trailingSpace = ' '.repeat(maxSurfaceId - info.surfaceIdWidth + 1);
		idx++;

		if (anyHasTransform) {
			if (info.hasTransform) {
				// Transform padding
				tokens[idx].trailingSpace = ' '.repeat(maxTransform - info.transformWidth + 1);
				idx++;
			} else {
				// No transform — add extra padding to skip transform column
				const currentPad = tokens[idx - 1].trailingSpace.length;
				tokens[idx - 1].trailingSpace = ' '.repeat(currentPad + maxTransform + 1);
			}
		}

		// Mnemonic padding
		tokens[info.mnemonicIdx].trailingSpace = ' '.repeat(
			maxMnemonic - info.mnemonicWidth + 1
		);
	}
}

// ─── Align surface parameters ───────────────────────────────────

/**
 * Align parameter values across same-type surfaces within each
 * consecutive card run. E.g., three PZ surfaces will have their
 * parameter columns aligned vertically.
 */
function alignSurfaceParameters(block: BlockNode): void {
	const runs = getConsecutiveCardRuns(block);
	for (const run of runs) {
		alignParametersByType(run);
	}
}

function alignParametersByType(cards: CardNode[]): void {
	// Group cards by surface mnemonic type (uppercased)
	const groups = new Map<string, { info: SurfaceLineInfo; card: CardNode }[]>();
	for (const card of cards) {
		const info = parseSurfaceStructure(card);
		if (!info) continue;
		const tokens = card.lines[0].tokens;
		const mnemonic = tokens[info.mnemonicIdx].text.toUpperCase();
		let group = groups.get(mnemonic);
		if (!group) {
			group = [];
			groups.set(mnemonic, group);
		}
		group.push({ info, card });
	}

	// For each same-type group with 2+ surfaces, align parameters
	for (const group of groups.values()) {
		if (group.length < 2) continue;

		// Find max width at each parameter position
		const maxWidths: number[] = [];
		for (const { info, card } of group) {
			const tokens = card.lines[0].tokens;
			const paramStart = info.mnemonicIdx + 1;
			for (let i = paramStart; i < tokens.length; i++) {
				const paramIdx = i - paramStart;
				const width = tokens[i].text.length;
				if (paramIdx >= maxWidths.length) {
					maxWidths.push(width);
				} else if (width > maxWidths[paramIdx]) {
					maxWidths[paramIdx] = width;
				}
			}
		}

		// Pad each parameter token's trailingSpace so columns align
		for (const { info, card } of group) {
			const tokens = card.lines[0].tokens;
			const paramStart = info.mnemonicIdx + 1;
			for (let i = paramStart; i < tokens.length; i++) {
				const paramIdx = i - paramStart;
				// Don't pad the last token on the line (preserve its existing trailing)
				if (i === tokens.length - 1) break;
				if (paramIdx < maxWidths.length) {
					const padNeeded = maxWidths[paramIdx] - tokens[i].text.length;
					tokens[i].trailingSpace = ' '.repeat(padNeeded + 1);
				}
			}
		}
	}
}

