/**
 * Data card formatting rules.
 *
 * §5.4 (p.275): Data cards begin in columns 1–5, followed by entries
 * separated by one or more blanks.
 *
 * Rules:
 * - Normalize keyword=value spacing
 * - Vertical format blocks (# in cols 1–5) and shorthand are always preserved
 *   (handled at the CST level — VerticalFormatNode is opaque, shorthand tokens
 *   are never modified)
 */

import {
	BlockNode,
	CardNode,
	TokenNode,
} from '../cst/types';
import { FormatterConfig } from '../config';
import { getConsecutiveCardRuns } from './shared';

/** Apply data card rules to the data block. */
export function applyDataRules(dataBlock: BlockNode, config: FormatterConfig): void {
	if (config.keywordSpacing !== 'preserve') {
		normalizeKeywordSpacing(dataBlock, config.keywordSpacing);
	}
	if (config.alignTallyBins) {
		alignTallyBins(dataBlock);
	}
}

// ─── Normalize keyword spacing ─────────────────────────────────

/**
 * Normalize spacing around = in KEYWORD=value pairs.
 * - "compact": FILL=1 (no spaces around =)
 * - "spaced": FILL = 1 (single space around =)
 *
 * This only affects tokens that contain = (the tokenizer keeps
 * KEYWORD=value as a single token since = has no whitespace around it).
 * If the user wrote FILL = 1 (spaces), the tokenizer splits into
 * three tokens: FILL, =, 1. We normalize the spacing of the = token.
 */
function normalizeKeywordSpacing(block: BlockNode, style: 'compact' | 'spaced'): void {
	for (const child of block.children) {
		if (child.type !== 'card') continue;

		for (const line of child.lines) {
			// Tokenizer splits on whitespace, so possible forms:
			// "KEY=val"  → 1 token: "KEY=val"
			// "KEY = val" → 3 tokens: "KEY", "=", "val"
			// "KEY =val"  → 2 tokens: "KEY", "=val"
			// "KEY= val"  → 2 tokens: "KEY=", "val"
			for (let i = 0; i < line.tokens.length; i++) {
				const token = line.tokens[i];

				// Case 1: standalone = token (from "KEY = val")
				if (token.text === '=' && i > 0 && i < line.tokens.length - 1) {
					if (style === 'compact') {
						line.tokens[i - 1].trailingSpace = '';
						token.trailingSpace = '';
						const keyword = line.tokens[i - 1];
						const value = line.tokens[i + 1];
						keyword.text = keyword.text + '=' + value.text;
						keyword.trailingSpace = value.trailingSpace;
						line.tokens.splice(i, 2);
						i--;
					} else {
						line.tokens[i - 1].trailingSpace = ' ';
						token.trailingSpace = ' ';
					}
					continue;
				}

				// Case 2: token starts with = (from "KEY =val")
				if (token.text.startsWith('=') && token.text.length > 1 && i > 0) {
					if (style === 'compact') {
						line.tokens[i - 1].trailingSpace = '';
						const keyword = line.tokens[i - 1];
						keyword.text = keyword.text + token.text;
						keyword.trailingSpace = token.trailingSpace;
						line.tokens.splice(i, 1);
						i--;
					} else {
						line.tokens[i - 1].trailingSpace = ' ';
						// Split =val into = + val
						const val = token.text.substring(1);
						token.text = '=';
						const valToken: TokenNode = {
							text: val,
							kind: token.kind,
							trailingSpace: token.trailingSpace,
						};
						token.trailingSpace = ' ';
						line.tokens.splice(i + 1, 0, valToken);
					}
					continue;
				}

				// Case 3: token ends with = (from "KEY= val")
				if (token.text.endsWith('=') && token.text.length > 1 && i < line.tokens.length - 1) {
					if (style === 'compact') {
						token.trailingSpace = '';
						const value = line.tokens[i + 1];
						token.text = token.text + value.text;
						token.trailingSpace = value.trailingSpace;
						line.tokens.splice(i + 1, 1);
					} else {
						// Split KEY= into KEY + =
						const key = token.text.substring(0, token.text.length - 1);
						token.text = key;
						token.trailingSpace = ' ';
						const eqToken: TokenNode = {
							text: '=',
							kind: token.kind,
							trailingSpace: ' ',
						};
						line.tokens.splice(i + 1, 0, eqToken);
						i++; // Skip the new = token
					}
					continue;
				}

				// Case 4: embedded = (from "KEY=val" as single token)
				const eqIdx = token.text.indexOf('=');
				if (eqIdx > 0 && eqIdx < token.text.length - 1) {
					if (style === 'spaced') {
						const key = token.text.substring(0, eqIdx);
						const val = token.text.substring(eqIdx + 1);
						token.text = key;
						token.trailingSpace = ' ';
						const eqToken: TokenNode = {
							text: '=',
							kind: token.kind,
							trailingSpace: ' ',
						};
						const valToken: TokenNode = {
							text: val,
							kind: token.kind,
							trailingSpace: token.trailingSpace,
						};
						// Replace trailing space was already set on token (now key)
						// but we need to use the original trailing space on valToken
						const origTrailing = token.trailingSpace;
						token.trailingSpace = ' ';
						valToken.trailingSpace = origTrailing;
						line.tokens.splice(i + 1, 0, eqToken, valToken);
						i += 2; // Skip the new tokens
					}
					// compact: already in compact form, nothing to do
				}
			}
		}
	}
}

// ─── Align tally bins ───────────────────────────────────────────

/** Regex matching tally bin card names: E, T, or C followed by digits. */
const TALLY_BIN_RE = /^[ETC]\d+$/i;

/**
 * Align numeric values across consecutive same-prefix tally bin cards.
 * E.g., two consecutive E cards will have their value columns aligned.
 */
function alignTallyBins(block: BlockNode): void {
	const runs = getConsecutiveCardRuns(block);
	for (const run of runs) {
		alignBinRun(run);
	}
}

/**
 * Get the tally bin prefix letter (E/T/C) from a card, or undefined
 * if it's not a tally bin card.
 */
function getTallyBinPrefix(card: CardNode): string | undefined {
	const firstLine = card.lines[0];
	if (!firstLine || firstLine.tokens.length < 2) return undefined;
	const name = firstLine.tokens[0].text;
	if (TALLY_BIN_RE.test(name)) {
		return name[0].toUpperCase();
	}
	return undefined;
}

function alignBinRun(cards: CardNode[]): void {
	// Group consecutive cards by their tally bin prefix
	let i = 0;
	while (i < cards.length) {
		const prefix = getTallyBinPrefix(cards[i]);
		if (!prefix) {
			i++;
			continue;
		}

		// Collect consecutive cards with the same prefix
		const group: CardNode[] = [cards[i]];
		let j = i + 1;
		while (j < cards.length && getTallyBinPrefix(cards[j]) === prefix) {
			group.push(cards[j]);
			j++;
		}

		if (group.length >= 2) {
			alignBinGroup(group);
		}

		i = j;
	}
}

function alignBinGroup(cards: CardNode[]): void {
	// Values start at token index 1 (after the card name)
	const maxWidths: number[] = [];
	for (const card of cards) {
		const tokens = card.lines[0].tokens;
		for (let i = 1; i < tokens.length; i++) {
			const valIdx = i - 1;
			const width = tokens[i].text.length;
			if (valIdx >= maxWidths.length) {
				maxWidths.push(width);
			} else if (width > maxWidths[valIdx]) {
				maxWidths[valIdx] = width;
			}
		}
	}

	// Pad trailingSpace so columns align
	for (const card of cards) {
		const tokens = card.lines[0].tokens;
		for (let i = 1; i < tokens.length; i++) {
			const valIdx = i - 1;
			// Don't pad the last token
			if (i === tokens.length - 1) break;
			if (valIdx < maxWidths.length) {
				const padNeeded = maxWidths[valIdx] - tokens[i].text.length;
				tokens[i].trailingSpace = ' '.repeat(padNeeded + 1);
			}
		}
	}
}
