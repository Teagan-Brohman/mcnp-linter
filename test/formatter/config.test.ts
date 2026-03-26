import { describe, it, expect } from 'vitest';
import { resolveConfigFromFile } from '../../server/src/formatter/config';

describe('resolveConfigFromFile', () => {
	it('returns default config when no file content provided', () => {
		const config = resolveConfigFromFile(undefined);
		expect(config.preset).toBe('default');
		expect(config.continuationStyle).toBe('indent');
	});

	it('parses valid JSON config and overlays on preset', () => {
		const json = '{"preset":"legacy","maxLineLength":72}';
		const config = resolveConfigFromFile(json);
		expect(config.preset).toBe('legacy');
		expect(config.continuationStyle).toBe('ampersand');
		expect(config.maxLineLength).toBe(72);
	});

	it('ignores invalid JSON gracefully', () => {
		const config = resolveConfigFromFile('{bad json');
		expect(config.preset).toBe('default');
	});

	it('enforces hard constraints from file config', () => {
		const json = '{"continuationIndent":3,"maxLineLength":200}';
		const config = resolveConfigFromFile(json);
		expect(config.continuationIndent).toBe(5);
		expect(config.maxLineLength).toBe(128);
	});

	it('ignores unknown keys', () => {
		const json = '{"unknownKey":"value","maxLineLength":80}';
		const config = resolveConfigFromFile(json);
		expect(config.maxLineLength).toBe(80);
	});
});
