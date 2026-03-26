/**
 * CST Emitter: walks the CST and produces the output string.
 *
 * Intentionally trivial — just concatenates all text content from
 * every node. Before any formatting rules are applied, the invariant
 * emit(parse(text)) === text must hold.
 */

import {
	McnpCST,
	BlockNode,
	BlockChild,
	CardNode,
	PhysicalLineNode,
	TokenNode,
} from './types';

/** Emit the full CST back to a string. */
export function emit(cst: McnpCST): string {
	const parts: string[] = [];

	if (cst.messageBlock) {
		parts.push(cst.messageBlock.rawText);
	}
	if (cst.messageDelimiter) {
		parts.push(emitBlankLines(cst.messageDelimiter.lines));
	}

	parts.push(cst.title.rawText);
	parts.push(emitBlock(cst.cellBlock));
	parts.push(emitBlankLines(cst.cellSurfaceDelimiter.lines));
	parts.push(emitBlock(cst.surfaceBlock));
	parts.push(emitBlankLines(cst.surfaceDataDelimiter.lines));
	parts.push(emitBlock(cst.dataBlock));

	if (cst.dataTerminator) {
		parts.push(emitBlankLines(cst.dataTerminator.lines));
	}
	if (cst.trailing) {
		parts.push(cst.trailing.rawText);
	}

	return parts.join('');
}

function emitBlankLines(lines: string[]): string {
	return lines.join('');
}

function emitBlock(block: BlockNode): string {
	const parts: string[] = [];
	for (const child of block.children) {
		parts.push(emitBlockChild(child));
	}
	return parts.join('');
}

function emitBlockChild(child: BlockChild): string {
	switch (child.type) {
		case 'card':
			return emitCard(child);
		case 'comment':
			return child.lines.join('');
		case 'blank':
			return child.lines.join('');
		case 'verticalFormat':
			return child.rawText;
	}
}

function emitCard(card: CardNode): string {
	const parts: string[] = [];
	for (const line of card.lines) {
		parts.push(emitPhysicalLine(line));
	}
	return parts.join('');
}

function emitPhysicalLine(line: PhysicalLineNode): string {
	const parts: string[] = [];

	parts.push(line.indent);

	for (const token of line.tokens) {
		parts.push(emitToken(token));
	}

	if (line.continuationMarker !== undefined) {
		parts.push(line.continuationMarker);
	}

	if (line.inlineComment) {
		parts.push(line.inlineComment.leadingSpace);
		parts.push(line.inlineComment.text);
	}

	parts.push(line.lineEnding);

	return parts.join('');
}

function emitToken(token: TokenNode): string {
	return token.text + token.trailingSpace;
}
