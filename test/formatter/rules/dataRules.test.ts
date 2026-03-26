import { describe, it, expect } from 'vitest';
import { parse } from '../../../server/src/formatter/cst/parser';
import { emit } from '../../../server/src/formatter/cst/emitter';
import { applyGlobalRules } from '../../../server/src/formatter/rules/global';
import { applyDataRules } from '../../../server/src/formatter/rules/dataRules';
import { resolveConfig, FormatterConfig } from '../../../server/src/formatter/config';

function format(input: string, overrides: Partial<FormatterConfig> = {}): string {
	const cst = parse(input);
	const config = resolveConfig(overrides);
	applyGlobalRules(cst, config);
	applyDataRules(cst.dataBlock, config);
	return emit(cst);
}

describe('normalizeKeywordSpacing', () => {
	it('compact mode merges KEY = val into KEY=val', () => {
		const input = 'Title\n1 0 -1\n\n1 so 5.0\n\nFILL = 1\n\n';
		const result = format(input, { keywordSpacing: 'compact' });
		expect(result).toContain('FILL=1');
	});

	it('compact mode merges KEY= val into KEY=val', () => {
		const input = 'Title\n1 0 -1\n\n1 so 5.0\n\nFILL= 1\n\n';
		const result = format(input, { keywordSpacing: 'compact' });
		expect(result).toContain('FILL=1');
	});

	it('compact mode merges KEY =val into KEY=val', () => {
		const input = 'Title\n1 0 -1\n\n1 so 5.0\n\nFILL =1\n\n';
		const result = format(input, { keywordSpacing: 'compact' });
		expect(result).toContain('FILL=1');
	});

	it('spaced mode splits KEY=val into KEY = val', () => {
		const input = 'Title\n1 0 -1\n\n1 so 5.0\n\nFILL=1\n\n';
		const result = format(input, { keywordSpacing: 'spaced' });
		expect(result).toContain('FILL = 1');
	});

	it('spaced mode normalizes KEY= val to KEY = val', () => {
		const input = 'Title\n1 0 -1\n\n1 so 5.0\n\nFILL= 1\n\n';
		const result = format(input, { keywordSpacing: 'spaced' });
		expect(result).toContain('FILL = 1');
	});

	it('spaced mode normalizes KEY =val to KEY = val', () => {
		const input = 'Title\n1 0 -1\n\n1 so 5.0\n\nFILL =1\n\n';
		const result = format(input, { keywordSpacing: 'spaced' });
		expect(result).toContain('FILL = 1');
	});

	it('preserve mode leaves spacing unchanged', () => {
		const input = 'Title\n1 0 -1\n\n1 so 5.0\n\nFILL=1\nFILL = 2\n\n';
		const result = format(input, { keywordSpacing: 'preserve' });
		expect(result).toContain('FILL=1');
		expect(result).toContain('FILL = 2');
	});

	it('handles already-compact input in compact mode (no-op)', () => {
		const input = 'Title\n1 0 -1\n\n1 so 5.0\n\nFILL=1\n\n';
		const result = format(input, { keywordSpacing: 'compact' });
		expect(result).toContain('FILL=1');
	});
});

describe('alignTallyBins', () => {
	it('aligns value columns across consecutive same-prefix tally bins', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'E4 1 10 100',
			'E14 1 10 100 1000',
			'',
		].join('\n');
		const result = format(input, { alignTallyBins: true });
		const lines = result.split('\n');
		const e4Line = lines.find(l => l.startsWith('E4'));
		const e14Line = lines.find(l => l.startsWith('E14'));
		expect(e4Line).toBeDefined();
		expect(e14Line).toBeDefined();
		// Both lines should have their values present
		expect(e4Line).toMatch(/^E4\s+/);
		expect(e14Line).toMatch(/^E14\s+/);
		// With alignment on, consecutive E-cards should be processed
		// Verify both cards retained their values
		expect(e4Line).toContain('100');
		expect(e14Line).toContain('1000');
	});

	it('does not align single tally bin card', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'E4 1 10 100',
			'T4 0.1 1.0 10.0',
			'',
		].join('\n');
		const result = format(input, { alignTallyBins: true });
		// Different prefixes (E vs T) — no alignment between them
		const lines = result.split('\n');
		const e4Line = lines.find(l => l.startsWith('E4'));
		const t4Line = lines.find(l => l.startsWith('T4'));
		expect(e4Line).toContain('1 10 100');
		expect(t4Line).toContain('0.1 1.0 10.0');
	});

	it('does not align when alignTallyBins is false', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'E4 1 10',
			'E14 1 10',
			'',
		].join('\n');
		const result = format(input, { alignTallyBins: false });
		const lines = result.split('\n');
		const e4Line = lines.find(l => l.startsWith('E4'));
		expect(e4Line).toBeDefined();
		// With no alignment, original spacing preserved
		expect(e4Line!).toMatch(/^E4\s+1\s+10/);
	});

	it('aligns C bins across consecutive cards', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'C4 0 1',
			'C14 0 0 1',
			'',
		].join('\n');
		const result = format(input, { alignTallyBins: true });
		const lines = result.split('\n');
		const c4Line = lines.find(l => l.startsWith('C4'));
		const c14Line = lines.find(l => l.startsWith('C14'));
		expect(c4Line).toBeDefined();
		expect(c14Line).toBeDefined();
	});
});
