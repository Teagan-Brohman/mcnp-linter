/**
 * Formatter configuration system.
 *
 * Resolution order: CLI flags > .mcnpfmt.json > VS Code settings > preset defaults
 */

export interface FormatterConfig {
	/** Preset: "default" or "legacy" */
	preset: 'default' | 'legacy';

	// ─── Global rules ───────────────────────────────────────

	/** Continuation style: "indent" (5-space) or "ampersand" (trailing &) */
	continuationStyle: 'indent' | 'ampersand';
	/** Number of spaces for continuation indent (minimum 5 per §4.4.6) */
	continuationIndent: number;
	/** Max line length: 0 = no wrapping, max 128 (§3.2.2) */
	maxLineLength: number;
	/** Tab handling: "convert" expands to MCNP 8-char tab stops, "preserve" leaves as-is */
	tabHandling: 'convert' | 'preserve';
	/** Line ending style */
	lineEnding: 'lf' | 'crlf';
	/** Remove trailing whitespace from lines */
	trimTrailingWhitespace: boolean;
	/** Maximum consecutive blank lines allowed within a block */
	maxConsecutiveBlankLines: number;
	/** Align inline $ comments to a target column */
	alignInlineComments: boolean;
	/** Target column for inline comment alignment */
	inlineCommentColumn: number;

	// ─── Cell card rules ────────────────────────────────────

	/** Align cell card columns (id, mat, density, geometry, params) */
	alignCellColumns: boolean;
	/** Normalize geometry spacing (single space between tokens) */
	normalizeGeometrySpacing: boolean;

	// ─── Surface card rules ─────────────────────────────────

	/** Align surface card columns (id, transform, mnemonic, params) */
	alignSurfaceColumns: boolean;
	/** Align surface parameters across same-type surfaces */
	alignSurfaceParameters: boolean;

	// ─── Material card rules ────────────────────────────────

	/** Align ZAID and fraction columns in material cards */
	alignMaterialComponents: boolean;
	/** Threshold for one-component-per-line layout */
	materialComponentThreshold: number;

	// ─── Data card rules ────────────────────────────────────

	/** Keyword=value spacing: "compact", "spaced", or "preserve" */
	keywordSpacing: 'compact' | 'spaced' | 'preserve';
	/** Align tally bin values */
	alignTallyBins: boolean;
}

/** Default preset: modern MCNP6 style */
export function getDefaultConfig(): FormatterConfig {
	return {
		preset: 'default',
		continuationStyle: 'indent',
		continuationIndent: 5,
		maxLineLength: 0,
		tabHandling: 'convert',
		lineEnding: 'lf',
		trimTrailingWhitespace: true,
		maxConsecutiveBlankLines: 2,
		alignInlineComments: false,
		inlineCommentColumn: 40,
		alignCellColumns: true,
		normalizeGeometrySpacing: true,
		alignSurfaceColumns: true,
		alignSurfaceParameters: true,
		alignMaterialComponents: true,
		materialComponentThreshold: 3,
		keywordSpacing: 'compact',
		alignTallyBins: true,
	};
}

/** Legacy preset: backward-compatible with older MCNP versions */
export function getLegacyConfig(): FormatterConfig {
	return {
		...getDefaultConfig(),
		preset: 'legacy',
		continuationStyle: 'ampersand',
		maxLineLength: 80,
	};
}

/** Get preset config by name */
function getPresetConfig(preset: 'default' | 'legacy'): FormatterConfig {
	return preset === 'legacy' ? getLegacyConfig() : getDefaultConfig();
}

/**
 * Resolve config from `.mcnpfmt.json` file content.
 * Returns default config on missing/invalid input; unknown keys are ignored.
 */
export function resolveConfigFromFile(jsonContent: string | undefined): FormatterConfig {
	if (!jsonContent) return resolveConfig();
	try {
		const parsed = JSON.parse(jsonContent);
		if (typeof parsed !== 'object' || parsed === null) return resolveConfig();
		const overrides: Partial<FormatterConfig> = {};
		if (parsed.preset === 'default' || parsed.preset === 'legacy') overrides.preset = parsed.preset;
		if (parsed.continuationStyle === 'indent' || parsed.continuationStyle === 'ampersand') overrides.continuationStyle = parsed.continuationStyle;
		if (typeof parsed.continuationIndent === 'number') overrides.continuationIndent = parsed.continuationIndent;
		if (typeof parsed.maxLineLength === 'number') overrides.maxLineLength = parsed.maxLineLength;
		if (parsed.tabHandling === 'convert' || parsed.tabHandling === 'preserve') overrides.tabHandling = parsed.tabHandling;
		if (parsed.lineEnding === 'lf' || parsed.lineEnding === 'crlf') overrides.lineEnding = parsed.lineEnding;
		if (typeof parsed.trimTrailingWhitespace === 'boolean') overrides.trimTrailingWhitespace = parsed.trimTrailingWhitespace;
		if (typeof parsed.maxConsecutiveBlankLines === 'number') overrides.maxConsecutiveBlankLines = parsed.maxConsecutiveBlankLines;
		if (typeof parsed.alignInlineComments === 'boolean') overrides.alignInlineComments = parsed.alignInlineComments;
		if (typeof parsed.inlineCommentColumn === 'number') overrides.inlineCommentColumn = parsed.inlineCommentColumn;
		if (typeof parsed.alignCellColumns === 'boolean') overrides.alignCellColumns = parsed.alignCellColumns;
		if (typeof parsed.normalizeGeometrySpacing === 'boolean') overrides.normalizeGeometrySpacing = parsed.normalizeGeometrySpacing;
		if (typeof parsed.alignSurfaceColumns === 'boolean') overrides.alignSurfaceColumns = parsed.alignSurfaceColumns;
		if (typeof parsed.alignSurfaceParameters === 'boolean') overrides.alignSurfaceParameters = parsed.alignSurfaceParameters;
		if (typeof parsed.alignMaterialComponents === 'boolean') overrides.alignMaterialComponents = parsed.alignMaterialComponents;
		if (typeof parsed.materialComponentThreshold === 'number') overrides.materialComponentThreshold = parsed.materialComponentThreshold;
		if (parsed.keywordSpacing === 'compact' || parsed.keywordSpacing === 'spaced' || parsed.keywordSpacing === 'preserve') overrides.keywordSpacing = parsed.keywordSpacing;
		if (typeof parsed.alignTallyBins === 'boolean') overrides.alignTallyBins = parsed.alignTallyBins;
		return resolveConfig(overrides);
	} catch {
		return resolveConfig();
	}
}

/**
 * Resolve a final config from partial overrides layered on top of a preset.
 * Enforces hard constraints from the MCNP manual.
 */
export function resolveConfig(overrides: Partial<FormatterConfig> = {}): FormatterConfig {
	const preset = overrides.preset ?? 'default';
	const base = getPresetConfig(preset);
	const merged = { ...base, ...overrides };

	// Enforce hard constraints
	// §4.4.6: continuation indent minimum 5
	if (merged.continuationIndent < 5) {
		merged.continuationIndent = 5;
	}
	// §3.2.2, Table 4.1: max line length 128
	if (merged.maxLineLength > 128) {
		merged.maxLineLength = 128;
	}
	if (merged.maxLineLength < 0) {
		merged.maxLineLength = 0;
	}
	if (merged.maxConsecutiveBlankLines < 0) {
		merged.maxConsecutiveBlankLines = 0;
	}
	if (merged.inlineCommentColumn < 1) {
		merged.inlineCommentColumn = 1;
	}

	return merged;
}
