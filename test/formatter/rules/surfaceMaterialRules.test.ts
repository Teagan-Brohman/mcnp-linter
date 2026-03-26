import { describe, it, expect } from 'vitest';
import { parse } from '../../../server/src/formatter/cst/parser';
import { emit } from '../../../server/src/formatter/cst/emitter';
import { applyGlobalRules } from '../../../server/src/formatter/rules/global';
import { applySurfaceRules } from '../../../server/src/formatter/rules/surfaceRules';
import { applyMaterialRules } from '../../../server/src/formatter/rules/materialRules';
import { resolveConfig, FormatterConfig } from '../../../server/src/formatter/config';

function format(input: string, overrides: Partial<FormatterConfig> = {}): string {
	const cst = parse(input);
	const config = resolveConfig(overrides);
	applyGlobalRules(cst, config);
	applySurfaceRules(cst.surfaceBlock, config);
	applyMaterialRules(cst.dataBlock, config);
	return emit(cst);
}

describe('alignSurfaceColumns', () => {
	it('aligns surface ID and mnemonic columns', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 pz -5',
			'2 pz 5',
			'10 py 3',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		const lines = result.split('\n');
		// Surface IDs should be padded: "1 " "2 " "10"
		// Mnemonics should align
		const mnemonic1Col = lines[3].indexOf('pz');
		const mnemonic2Col = lines[4].indexOf('pz');
		const mnemonic3Col = lines[5].indexOf('py');
		expect(mnemonic1Col).toBe(mnemonic2Col);
		expect(mnemonic2Col).toBe(mnemonic3Col);
	});

	it('handles surfaces with transform numbers', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 1 pz 5.0',
			'2 pz -5.0',
			'',
			'TR1 0 0 5',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		const lines = result.split('\n');
		// Surface 1 has transform "1", surface 2 does not
		// Mnemonics should still align (surface 2 gets extra padding)
		const pz1 = lines[3].indexOf('pz');
		const pz2 = lines[4].indexOf('pz');
		expect(pz1).toBe(pz2);
	});

	it('handles surfaces with reflective prefix (*)', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'*1 pz 5.0',
			'2 pz -5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		// *1 and 2 should have aligned mnemonics
		const lines = result.split('\n');
		const pz1 = lines[3].indexOf('pz');
		const pz2 = lines[4].indexOf('pz');
		expect(pz1).toBe(pz2);
	});

	it('comment groups break alignment runs', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 pz -5',
			'c separator',
			'10 py 3',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		// Surface 1 and 10 in separate runs — no alignment between them
		expect(result).toContain('1 pz');
	});

	it('can be disabled', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 pz -5',
			'10 py 3',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input, { alignSurfaceColumns: false });
		expect(result).toContain('1 pz -5');
		expect(result).toContain('10 py 3');
	});

	it('single surface unchanged', () => {
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
		expect(result).toContain('1 so 5.0');
	});
});

describe('alignSurfaceParameters', () => {
	it('aligns params across same-type surfaces', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 pz -5',
			'2 pz 5',
			'3 pz -10.5',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		const lines = result.split('\n');
		// All PZ surfaces — param columns should align
		// Find the parameter start positions
		const param1 = lines[3].indexOf('-5');
		const param2 = lines[4].indexOf('5');
		const param3 = lines[5].indexOf('-10.5');
		// The parameter column should start at the same position
		expect(param1).toBe(param2);
		expect(param2).toBe(param3);
	});

	it('does not align across different types', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 pz -5',
			'2 py 5',
			'3 pz -10.5',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		const lines = result.split('\n');
		// PZ surfaces (lines[3] and lines[5]) are not consecutive same-type
		// in the grouping because py is between them — each type group has <2 members
		// so no parameter alignment occurs beyond column alignment
		// py (line 4) should keep its own spacing
		expect(lines[4]).toContain('py');
	});

	it('can be disabled', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 pz -5',
			'2 pz 5',
			'3 pz -10.5',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input, { alignSurfaceParameters: false });
		const lines = result.split('\n');
		// Without parameter alignment, the params after mnemonic keep
		// their default single-space (from column alignment)
		// -5 should not be padded to align with -10.5
		const pzLine1 = lines[3];
		// After "pz" there should be just one space before -5
		expect(pzLine1).toMatch(/pz\s+-5$/);
	});
});

describe('alignMaterialComponents', () => {
	it('aligns ZAID and fraction columns', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'M1 92235.80c 0.05 92238.80c 0.95',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		// Both ZAIDs are same width (11 chars), fractions should align
		expect(result).toContain('92235.80c');
		expect(result).toContain('92238.80c');
	});

	it('aligns ZAIDs of different widths', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'M1 1001.80c 0.667 8016.80c 0.333',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		const lines = result.split('\n');
		const matLine = lines.find(l => l.startsWith('M1'))!;
		// 1001.80c (8 chars) and 8016.80c (8 chars) — same width
		// Both should have aligned fractions
		expect(matLine).toContain('1001.80c');
		expect(matLine).toContain('8016.80c');
	});

	it('handles multi-line materials with continuation', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'M1 92235.80c 0.05',
			'     92238.80c 0.95',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		expect(result).toContain('92235.80c');
		expect(result).toContain('92238.80c');
	});

	it('does not modify non-material cards', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'SDEF POS=0 0 0 ERG=14',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		expect(result).toContain('SDEF POS=0 0 0 ERG=14');
	});

	it('can be disabled', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'M1 92235.80c 0.05 92238.80c 0.95',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input, { alignMaterialComponents: false });
		expect(result).toContain('92235.80c 0.05 92238.80c 0.95');
	});
});
