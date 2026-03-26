/**
 * Formatter pipeline: parse → rules → emit.
 *
 * This is the main entry point for formatting MCNP input files.
 * Used by both the LSP handlers and the CLI.
 */

import { parse } from './cst/parser';
import { emit } from './cst/emitter';
import { FormatterConfig, resolveConfig } from './config';
import { applyGlobalRules } from './rules/global';
import { applyCellRules } from './rules/cellRules';
import { applySurfaceRules } from './rules/surfaceRules';
import { applyMaterialRules } from './rules/materialRules';
import { applyDataRules } from './rules/dataRules';

/**
 * Format an MCNP input file.
 *
 * @param text - Raw input file text
 * @param overrides - Partial config overrides (layered on preset defaults)
 * @returns Formatted text
 */
export function formatMcnpInput(
	text: string,
	overrides: Partial<FormatterConfig> = {},
): string {
	const config = resolveConfig(overrides);
	const cst = parse(text);

	// Apply rules in order: global first, then card-specific
	applyGlobalRules(cst, config);
	applyCellRules(cst.cellBlock, config);
	applySurfaceRules(cst.surfaceBlock, config);
	applyMaterialRules(cst.dataBlock, config);
	applyDataRules(cst.dataBlock, config);

	return emit(cst);
}

/**
 * Compute TextEdit-style diff between original and formatted text.
 * Returns the edits needed to transform original into formatted.
 *
 * For LSP integration: returns a single full-document replacement
 * if the text changed, or empty array if no changes needed.
 */
export function formatToEdits(
	text: string,
	overrides: Partial<FormatterConfig> = {},
): { newText: string; changed: boolean } {
	const formatted = formatMcnpInput(text, overrides);
	return {
		newText: formatted,
		changed: formatted !== text,
	};
}
