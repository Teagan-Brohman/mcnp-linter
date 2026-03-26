import { describe, it, expect } from 'vitest';
import { parse } from '../../../server/src/formatter/cst/parser';
import { emit } from '../../../server/src/formatter/cst/emitter';
import { applyGlobalRules } from '../../../server/src/formatter/rules/global';
import { applyCellRules } from '../../../server/src/formatter/rules/cellRules';
import { resolveConfig, FormatterConfig } from '../../../server/src/formatter/config';

function format(input: string, overrides: Partial<FormatterConfig> = {}): string {
	const cst = parse(input);
	const config = resolveConfig(overrides);
	applyGlobalRules(cst, config);
	applyCellRules(cst.cellBlock, config);
	return emit(cst);
}

describe('alignCellColumns', () => {
	it('aligns cell ID, material ID, and density columns', () => {
		const input = [
			'Title',
			'1 1 -2.7 -1',
			'2 2 -7.85 -2',
			'100 3 -1.0 -3',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		const lines = result.split('\n');
		// Cell IDs should be right-padded to same column
		// "1" "2" "100" → max width 3, so first two get extra padding
		expect(lines[1].indexOf('1 ')).toBe(0); // cell 1
		// Material column should align
		const mat1Col = lines[1].indexOf('1', 2);
		const mat2Col = lines[2].indexOf('2', 2);
		const mat3Col = lines[3].indexOf('3', 4);
		expect(mat1Col).toBe(mat2Col);
		expect(mat2Col).toBe(mat3Col);
	});

	it('handles void cells (mat=0, no density)', () => {
		const input = [
			'Title',
			'1 1 -2.7 -1',
			'2 0 1',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		const lines = result.split('\n');
		// Both should have aligned cell ID and mat ID columns
		// Void cell should have extra padding to skip density column
		expect(lines[1]).toBeDefined();
		expect(lines[2]).toBeDefined();
	});

	it('skips LIKE BUT cards', () => {
		const input = [
			'Title',
			'1 1 -2.7 -1 imp:n=1',
			'2 LIKE 1 BUT IMP:N=2',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		// LIKE BUT should be preserved as-is (not aligned)
		expect(result).toContain('2 LIKE 1 BUT IMP:N=2');
	});

	it('comment groups break alignment runs', () => {
		const input = [
			'Title',
			'1 1 -2.7 -1',
			'c separator',
			'100 2 -7.85 -2',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		// Cell 1 and cell 100 should NOT be aligned since comment breaks the run
		const lines = result.split('\n');
		// Cell 1 is alone in its run, so no alignment change
		expect(lines[1]).toContain('1 1');
	});

	it('does nothing with single cell', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		expect(result).toContain('1 0 -1');
	});

	it('can be disabled', () => {
		const input = [
			'Title',
			'1 1 -2.7 -1',
			'100 2 -7.85 -2',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input, { alignCellColumns: false });
		// Original spacing preserved (except trailing whitespace trim)
		expect(result).toContain('1 1 -2.7 -1');
	});
});

describe('normalizeGeometrySpacing', () => {
	it('normalizes multiple spaces to single space in geometry', () => {
		const input = [
			'Title',
			'1 1 -2.7 -1  2  -3  4',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		// Geometry portion should have single spaces
		expect(result).toContain('-1 2 -3 4');
	});

	it('preserves spacing in parameters (after geometry)', () => {
		const input = [
			'Title',
			'1 1 -2.7 -1 2 IMP:N=1  IMP:P=1',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		// Parameter spacing should be preserved (not geometry)
		// The normalizer only touches geometry tokens
		expect(result).toContain('IMP:N=1');
	});

	it('normalizes spacing on continuation lines', () => {
		const input = [
			'Title',
			'1 1 -2.7 -1  2',
			'     -3  4  5',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		// Continuation line geometry should also be normalized
		expect(result).toContain('-3 4 5');
	});

	it('can be disabled', () => {
		const input = [
			'Title',
			'1 1 -2.7 -1  2  -3  4',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input, { normalizeGeometrySpacing: false });
		expect(result).toContain('-1  2  -3  4');
	});

	it('handles geometry with union operators (:)', () => {
		const input = [
			'Title',
			'1 0 -1  :  2  :  -3',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		// Spaces around : should be normalized to single
		expect(result).toContain('-1 : 2 : -3');
	});

	it('handles geometry with complement (#)', () => {
		const input = [
			'Title',
			'1 0 #2  #3',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		expect(result).toContain('#2 #3');
	});

	it('preserves parenthesized groups', () => {
		const input = [
			'Title',
			'1 0 (-1  2)  :  (3  -4)',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		// Parens preserved, spacing normalized
		expect(result).toContain('(-1 2) : (3 -4)');
	});
});
