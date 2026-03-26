import { describe, it, expect } from 'vitest';
import { parse } from '../../../server/src/formatter/cst/parser';
import { emit } from '../../../server/src/formatter/cst/emitter';

function roundTrip(input: string): string {
	return emit(parse(input));
}

describe('CST round-trip: emit(parse(text)) === text', () => {
	it('simple 3-block file', () => {
		const input = [
			'Sample Problem Title',
			'1 1 -2.7 -1 2 -3 4',
			'2 0 -5',
			'',
			'1 pz -5',
			'2 pz 5',
			'',
			'M1 92235.80c 0.05 92238.80c 0.95',
			'NPS 1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with message block', () => {
		const input = [
			'message: o=sphere.o r=sphere.r',
			'',
			'Title: bare uranium sphere',
			'1 1 -18.7 -1',
			'2 0 1',
			'',
			'1 so 5.0',
			'',
			'M1 92235.80c 1.0',
			'NPS 10000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with inline comments ($)', () => {
		const input = [
			'Test with comments',
			'1 1 -2.7 -1 $ fuel cell',
			'2 0 1     $ outside world',
			'',
			'1 so 5.0  $ sphere',
			'',
			'M1 92235.80c 1.0 $ enriched uranium',
			'NPS 1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with 5-space indent continuation lines', () => {
		const input = [
			'Continuation test',
			'1 1 -2.7 -1 2 -3 4',
			'     -5 6 -7 8',
			'     imp:n=1',
			'2 0 10',
			'',
			'1 pz -5',
			'',
			'M1 92235.80c 0.05',
			'     92238.80c 0.95',
			'NPS 1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with ampersand continuation', () => {
		const input = [
			'Ampersand continuation test',
			'1 1 -2.7 -1 2 -3 4 &',
			'-5 6 -7 8 &',
			'imp:n=1',
			'2 0 10',
			'',
			'1 pz -5',
			'',
			'M1 92235.80c 1.0',
			'NPS 1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with full-line comments (c in col 1)', () => {
		const input = [
			'Comment test',
			'c cell cards for sample problem',
			'1 1 -2.7 -1',
			'c void cell',
			'2 0 1',
			'c end of cell cards',
			'',
			'c surface cards',
			'1 so 5.0',
			'',
			'M1 92235.80c 1.0',
			'NPS 1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with trailing content after terminator', () => {
		const input = [
			'Trailing content test',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
			'This is trailing content that MCNP ignores.',
			'It can contain anything.',
			'Even more stuff.',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with tabs', () => {
		const input = [
			'Tab test',
			'1\t1\t-2.7\t-1',
			'2\t0\t1',
			'',
			'1\tso\t5.0',
			'',
			'M1\t92235.80c\t1.0',
			'NPS\t1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with CRLF line endings', () => {
		const input = [
			'CRLF test',
			'1 0 -1',
			'2 0 1',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\r\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with mixed spacing and alignment', () => {
		const input = [
			'Mixed spacing test',
			'1  1  -2.70  -1 2 -3 4    imp:n=1 imp:p=1',
			'2  2  -7.85  -5 6 -7 8    imp:n=1 imp:p=1',
			'3  0          10 -11 12   imp:n=0 imp:p=0',
			'',
			'c Beginning of surfaces for cube',
			'1 pz -5',
			'2 pz  5',
			'3 py  5',
			'4 py -5',
			'5 px  5',
			'6 px -5',
			'',
			'M1 92235.80c 0.05 92238.80c 0.95',
			'NPS 1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with shorthand notation', () => {
		const input = [
			'Shorthand test',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'IMP:N 1 3R 0',
			'E0 1 2 3 4 5 6 7 8 9 10 11 12 13 14',
			'NPS 1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with no trailing newline', () => {
		const input = [
			'No trailing newline',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('minimal file (title only)', () => {
		const input = 'Title only\n';
		expect(roundTrip(input)).toBe(input);
	});

	it('file with multiple consecutive blank lines between blocks', () => {
		// This is technically invalid MCNP but the parser must round-trip it
		const input = [
			'Multiple blanks',
			'1 0 -1',
			'',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with comment interleaved with cards', () => {
		const input = [
			'Interleaved comments',
			'c --- fuel region ---',
			'1 1 -2.7 -1',
			'c --- moderator ---',
			'2 2 -1.0 1 -2',
			'c --- void ---',
			'3 0 2',
			'',
			'1 so 5.0',
			'2 so 10.0',
			'',
			'M1 92235.80c 1.0',
			'M2 1001.80c 2.0 8016.80c 1.0',
			'NPS 1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with keyword=value pairs', () => {
		const input = [
			'Keyword test',
			'1 1 -2.7 -1 IMP:N=1 IMP:P=1 VOL=100 TMP=2.53e-8',
			'2 0 1 IMP:N=0',
			'',
			'1 so 5.0',
			'',
			'M1 92235.80c 1.0 NLIB=80c',
			'NPS 1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with geometry operators (: # parens)', () => {
		const input = [
			'Geometry operators',
			'1 0 -1 2 -3',
			'2 0 (-1:2) -3',
			'3 0 #1 #2',
			'4 0 -1 : 2 : 3 : -4 : 5 : -6',
			'',
			'1 pz -5',
			'2 pz 5',
			'3 py 5',
			'',
			'NPS 1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with density as positive (atom density)', () => {
		const input = [
			'Atom density',
			'1 1 0.048 -1',
			'2 0 1',
			'',
			'1 so 5.0',
			'',
			'M1 92235.80c 1.0',
			'NPS 1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('preserves exact whitespace in continuation lines', () => {
		// 6-space indent (more than minimum 5)
		const input = [
			'Indent preservation',
			'1 1 -2.7 -1 2 -3',
			'      imp:n=1',
			'',
			'1 pz -5',
			'',
			'NPS 1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with surface transform prefix', () => {
		const input = [
			'Transform test',
			'1 0 -1',
			'',
			'1 1 pz 5.0',
			'*2 px 3.0',
			'',
			'TR1 0 0 5',
			'NPS 1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with LIKE BUT card', () => {
		const input = [
			'LIKE BUT test',
			'1 1 -2.7 -1 imp:n=1',
			'2 LIKE 1 BUT IMP:N=2',
			'3 0 1 imp:n=0',
			'',
			'1 so 5.0',
			'',
			'M1 92235.80c 1.0',
			'NPS 1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with tally and modifier cards', () => {
		const input = [
			'Tally test',
			'1 1 -2.7 -1',
			'2 0 1',
			'',
			'1 so 5.0',
			'',
			'M1 92235.80c 1.0',
			'F2:N 1',
			'E2 1 2 3 4 5 6 7 8 9 10 11 12 13 14',
			'FC2 Neutron flux on sphere surface',
			'SDEF POS=0 0 0 ERG=14',
			'NPS 10000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with vertical format block (# in cols 1–5)', () => {
		const input = [
			'Vertical format test',
			'1 0 -1',
			'2 0 1',
			'',
			'1 so 5.0',
			'',
			'#  IMP:N  IMP:P  VOL',
			'   1      1      100',
			'   0      0      0',
			'NPS 1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('file with TMESH...ENDMD block', () => {
		const input = [
			'TMESH test',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'TMESH',
			'  CORA1 -10 9I 10',
			'  CORB1 -10 9I 10',
			'  CORC1 -10 9I 10',
			'ENDMD',
			'NPS 1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('ampersand continuation with inline comment on same line', () => {
		const input = [
			'Ampersand with comment',
			'1 1 -2.7 -1 2 -3 4 & $ geometry continues',
			'5 -6 7 -8',
			'2 0 10',
			'',
			'1 pz -5',
			'',
			'M1 92235.80c 1.0',
			'NPS 1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('comment with c in column 3 (spaces before c)', () => {
		const input = [
			'Comment in col 3',
			'  c this is a valid comment',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});

	it('empty string input', () => {
		expect(roundTrip('')).toBe('');
	});

	it('preserves trailing whitespace on lines', () => {
		const input = [
			'Trailing spaces   ',
			'1 0 -1   ',
			'',
			'1 so 5.0  ',
			'',
			'NPS 1000  ',
			'',
		].join('\n');
		expect(roundTrip(input)).toBe(input);
	});
});

describe('CST parser structure', () => {
	it('correctly identifies block kinds', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const cst = parse(input);
		expect(cst.cellBlock.blockKind).toBe('cell');
		expect(cst.surfaceBlock.blockKind).toBe('surface');
		expect(cst.dataBlock.blockKind).toBe('data');
	});

	it('parses title card', () => {
		const input = [
			'My Problem Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const cst = parse(input);
		expect(cst.title.rawText).toBe('My Problem Title\n');
	});

	it('identifies continuation lines', () => {
		const input = [
			'Title',
			'1 1 -2.7 -1',
			'     imp:n=1',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const cst = parse(input);
		const cellCard = cst.cellBlock.children.find(c => c.type === 'card');
		expect(cellCard).toBeDefined();
		if (cellCard?.type === 'card') {
			expect(cellCard.lines).toHaveLength(2);
			expect(cellCard.lines[0].isContinuation).toBe(false);
			expect(cellCard.lines[1].isContinuation).toBe(true);
		}
	});

	it('preserves inline comment structure', () => {
		const input = [
			'Title',
			'1 0 -1  $ void cell',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const cst = parse(input);
		const cellCard = cst.cellBlock.children.find(c => c.type === 'card');
		if (cellCard?.type === 'card') {
			expect(cellCard.lines[0].inlineComment).toBeDefined();
			expect(cellCard.lines[0].inlineComment?.text).toBe('$ void cell');
		}
	});

	it('detects message block', () => {
		const input = [
			'message: o=out.o r=run.r',
			'',
			'Title Card',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const cst = parse(input);
		expect(cst.messageBlock).toBeDefined();
		expect(cst.messageBlock?.rawText).toContain('message:');
		expect(cst.messageDelimiter).toBeDefined();
		expect(cst.title.rawText).toContain('Title Card');
	});

	it('detects trailing content', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
			'This is notes after the deck.',
			'More notes.',
		].join('\n');
		const cst = parse(input);
		expect(cst.dataTerminator).toBeDefined();
		expect(cst.trailing).toBeDefined();
		expect(cst.trailing?.rawText).toContain('This is notes');
	});

	it('counts tokens correctly', () => {
		const input = [
			'Title',
			'1 1 -2.7 -1 2 -3 4',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const cst = parse(input);
		const cellCard = cst.cellBlock.children.find(c => c.type === 'card');
		if (cellCard?.type === 'card') {
			// "1 1 -2.7 -1 2 -3 4" = 7 tokens
			expect(cellCard.lines[0].tokens).toHaveLength(7);
		}
	});

	it('separates comment groups from cards', () => {
		const input = [
			'Title',
			'c comment 1',
			'c comment 2',
			'1 0 -1',
			'c another comment',
			'2 0 1',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const cst = parse(input);
		const children = cst.cellBlock.children;
		expect(children[0].type).toBe('comment');
		expect(children[1].type).toBe('card');
		expect(children[2].type).toBe('comment');
		expect(children[3].type).toBe('card');
	});
});
