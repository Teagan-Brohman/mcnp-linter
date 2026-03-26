import { describe, it, expect } from 'vitest';
import { formatMcnpInput, formatToEdits } from '../../server/src/formatter/formatter';
import { FormatterConfig } from '../../server/src/formatter/config';

function format(input: string, overrides: Partial<FormatterConfig> = {}): string {
	return formatMcnpInput(input, overrides);
}

describe('dataRules: normalizeKeywordSpacing', () => {
	it('preserves compact keyword=value (default)', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'SDEF POS=0 ERG=14',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		expect(result).toContain('POS=0');
		expect(result).toContain('ERG=14');
	});

	it('preserves keyword=value when style is "preserve"', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'SDEF POS = 0 ERG = 14',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input, { keywordSpacing: 'preserve' });
		expect(result).toContain('POS = 0');
		expect(result).toContain('ERG = 14');
	});

	it('normalizes spaced keywords to compact', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'SDEF POS = 0 ERG = 14',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input, { keywordSpacing: 'compact' });
		expect(result).toContain('POS=0');
		expect(result).toContain('ERG=14');
	});

	it('normalizes to spaced style', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'SDEF POS = 0 ERG =14',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input, { keywordSpacing: 'spaced' });
		// = should have single space before and after
		expect(result).toContain('POS = 0');
		expect(result).toContain('ERG = 14');
	});
});

describe('alignTallyBins', () => {
	it('aligns E bin values across consecutive E cards', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'E2 0.1 0.5 1 2 5 10 14',
			'E4 0.1 0.5 1 2 5 10 14',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		const lines = result.split('\n');
		// Find the two E lines
		const eLine1 = lines.find(l => l.startsWith('E2'))!;
		const eLine2 = lines.find(l => l.startsWith('E4'))!;
		expect(eLine1).toBeDefined();
		expect(eLine2).toBeDefined();
		// Values after the card name should align — strip card name prefix
		// Card names are same length (E2, E4), so values start at same offset
		const vals1 = eLine1.substring(2);
		const vals2 = eLine2.substring(2);
		expect(vals1).toBe(vals2);
	});

	it('aligns E bin values with different widths', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'E2 0.1 1 10',
			'E4 0.001 0.5 1',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		const lines = result.split('\n');
		const eLine1 = lines.find(l => l.startsWith('E2'))!;
		const eLine2 = lines.find(l => l.startsWith('E4'))!;
		// "0.1" vs "0.001" — second is wider, so first gets padded
		// After the card name, find where the second value starts
		const val2Start1 = eLine1.indexOf('1', eLine1.indexOf('0.1') + 3);
		const val2Start2 = eLine2.indexOf('0.5');
		// The second value columns should be aligned
		expect(val2Start1).toBe(val2Start2);
	});

	it('can be disabled', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'E2 0.1 1 10',
			'E4 0.001 0.5 1',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input, { alignTallyBins: false });
		// With alignment disabled, spacing should be preserved as-is
		// (just trimmed trailing whitespace from global rules)
		expect(result).toContain('E2 0.1 1 10');
		expect(result).toContain('E4 0.001 0.5 1');
	});
});

describe('formatMcnpInput pipeline', () => {
	it('applies all rules to a complete deck', () => {
		const input = [
			'Complete deck test',
			'c cell cards',
			'1  1  -2.70  -1  2  -3  4   ',
			'2  2  -7.85  -5  6  -7  8   ',
			'3  0          10  -11  12   ',
			'',
			'c surface cards',
			'1 pz -5',
			'2 pz 5',
			'10 py 3',
			'',
			'M1 92235.80c 0.05 92238.80c 0.95',
			'M2 26054.80c 0.06 26056.80c 0.92 26057.80c 0.02',
			'SDEF POS=0 0 0 ERG=14',
			'NPS 10000',
			'',
		].join('\n');
		const result = format(input);
		// Trailing whitespace should be trimmed
		expect(result).not.toMatch(/  +\n/);
		// Structure should be preserved
		expect(result).toContain('c cell cards');
		expect(result).toContain('c surface cards');
	});

	it('preserves unformatted file identity', () => {
		// A file that's already "formatted" should be unchanged
		// (idempotency with default config minus alignment)
		const input = [
			'Already clean',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input);
		// Should be essentially the same (single card = no alignment changes)
		expect(result).toContain('1 0 -1');
		expect(result).toContain('1 so 5.0');
		expect(result).toContain('NPS 1000');
	});

	it('handles empty file', () => {
		expect(format('')).toBe('');
	});

	it('handles legacy preset', () => {
		const input = [
			'Legacy test',
			'1 1 -2.7 -1',
			'     imp:n=1',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = format(input, { preset: 'legacy' });
		// Legacy should use & continuation
		expect(result).toContain(' &');
	});
});

describe('formatToEdits', () => {
	it('returns changed=false for already formatted file', () => {
		const input = [
			'Title',
			'1 0 -1',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		// Format once to get the "clean" version
		const formatted = formatMcnpInput(input);
		// Second format should produce no changes
		const result = formatToEdits(formatted);
		expect(result.changed).toBe(false);
		expect(result.newText).toBe(formatted);
	});

	it('returns changed=true for dirty file', () => {
		const input = [
			'Title',
			'1 0 -1   ',
			'',
			'1 so 5.0',
			'',
			'NPS 1000',
			'',
		].join('\n');
		const result = formatToEdits(input);
		expect(result.changed).toBe(true);
		expect(result.newText).not.toContain('-1   ');
	});
});
