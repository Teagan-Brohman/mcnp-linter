/**
 * CLI entry point for mcnp-fmt.
 *
 * Reads MCNP input files, formats them, and writes back or reports diffs.
 * Config resolution: CLI flags > .mcnpfmt.json (auto-discovered) > preset defaults.
 */

import { formatMcnpInput } from './formatter';
import { resolveConfigFromFile, FormatterConfig } from './config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

export interface ProcessResult {
	output: string;
	changed: boolean;
}

/**
 * Format input text using the formatter pipeline.
 *
 * @param input - Raw MCNP input text
 * @param cliOverrides - Config overrides from CLI flags
 * @param configFileJson - Optional raw JSON from .mcnpfmt.json
 */
export function processInput(
	input: string,
	cliOverrides: Partial<FormatterConfig>,
	configFileJson?: string,
): ProcessResult {
	const fileConfig = configFileJson ? resolveConfigFromFile(configFileJson) : undefined;
	const baseOverrides = fileConfig ? { ...fileConfig, ...cliOverrides } : cliOverrides;
	const output = formatMcnpInput(input, baseOverrides);
	return { output, changed: output !== input };
}

/**
 * Walk up from startDir looking for .mcnpfmt.json.
 * Returns the absolute path if found, undefined otherwise.
 */
export function findConfigFile(startDir: string): string | undefined {
	let dir = resolve(startDir);
	const root = resolve('/');
	while (dir !== root) {
		const candidate = resolve(dir, '.mcnpfmt.json');
		if (existsSync(candidate)) return candidate;
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return undefined;
}

/** Parse CLI args and run the formatter. Returns exit code. */
export function main(args: string[]): number {
	let mode: 'write' | 'check' | 'diff' = 'write';
	let presetName: string | undefined;
	let configPath: string | undefined;
	let useStdin = false;
	const files: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === '--check') mode = 'check';
		else if (arg === '--diff') mode = 'diff';
		else if (arg === '--write') mode = 'write';
		else if (arg === '--stdin') useStdin = true;
		else if (arg === '--preset' && i + 1 < args.length) presetName = args[++i];
		else if (arg === '--config' && i + 1 < args.length) configPath = args[++i];
		else if (arg === '--help') { printHelp(); return 0; }
		else if (!arg.startsWith('-')) files.push(arg);
	}

	const cliOverrides: Partial<FormatterConfig> = {};
	if (presetName === 'default' || presetName === 'legacy') cliOverrides.preset = presetName;

	let configJson: string | undefined;
	if (configPath) {
		configJson = readFileSync(configPath, 'utf-8');
	} else if (files.length > 0) {
		const found = findConfigFile(dirname(resolve(files[0])));
		if (found) configJson = readFileSync(found, 'utf-8');
	}

	if (useStdin || files.length === 0) {
		const input = readFileSync(0, 'utf-8');
		const result = processInput(input, cliOverrides, configJson);
		if (mode === 'check') return result.changed ? 1 : 0;
		process.stdout.write(result.output);
		return 0;
	}

	let anyChanged = false;
	for (const file of files) {
		const input = readFileSync(file, 'utf-8');
		const result = processInput(input, cliOverrides, configJson);
		if (result.changed) anyChanged = true;
		if (mode === 'write' && result.changed) writeFileSync(file, result.output, 'utf-8');
		else if (mode === 'diff' && result.changed) {
			process.stdout.write(`--- ${file}\n+++ ${file} (formatted)\n`);
			process.stdout.write(result.output);
		}
	}
	return mode === 'check' && anyChanged ? 1 : 0;
}

function printHelp(): void {
	process.stdout.write(`mcnp-fmt - MCNP input file formatter

Usage: mcnp-fmt [options] [files...]

Options:
  --check          Exit with code 1 if any file would change (for CI)
  --diff           Print diff instead of writing
  --write          Format files in place (default)
  --preset NAME    Use named preset ("default" or "legacy")
  --config PATH    Path to .mcnpfmt.json (auto-detected from cwd)
  --stdin          Read from stdin, write to stdout
  --help           Show this help
`);
}
