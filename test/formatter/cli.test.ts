import { describe, it, expect } from 'vitest';
import { processInput } from '../../server/src/formatter/cli';

describe('CLI processInput', () => {
	it('formats input text with default config', () => {
		const input = 'Title\n1 0 -1   \n\n1 so 5.0\n\nNPS 1000\n';
		const result = processInput(input, {});
		expect(result.output).not.toContain('-1   ');
		expect(result.changed).toBe(true);
	});

	it('returns changed=false for already-formatted input', () => {
		const input = 'Title\n1 0 -1\n\n1 so 5.0\n\nNPS 1000\n';
		const formatted = processInput(input, {});
		const result = processInput(formatted.output, {});
		expect(result.changed).toBe(false);
	});

	it('accepts preset override', () => {
		const input = 'Title\n1 1 -2.7 -1\n     imp:n=1\n\n1 so 5.0\n\nNPS 1000\n';
		const result = processInput(input, { preset: 'legacy' });
		expect(result.output).toContain(' &');
	});

	it('accepts config file JSON', () => {
		const input = 'Title\n1 0 -1   \n\n1 so 5.0\n\nNPS 1000\n';
		const configJson = '{"maxLineLength":80}';
		const result = processInput(input, {}, configJson);
		expect(result.changed).toBe(true);
	});
});
