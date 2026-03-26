# MCNP Linter

A Visual Studio Code language server for MCNP input files (`.i`, `.inp`, `.mcnp`).
Provides validation checks, LSP features, and early stage CST-based formatter. 

This is a mostly a side project of mine so there is probably a large amount of edge cases that have not been even thought about. Additionally there might be warnings that aren't actually warnings, should be able to silence in settings if need be.

This won't magically fix bad MCNP files but may help the ocassional debugging for surfaces, materials, or those sneaky double blank line delimiters.

> **Companion extension** - recommend to pair with
> [MCNP6 Syntax Highlighting and Snippets](https://marketplace.visualstudio.com/items?itemName=repositony.vscodemcnp)
> for grammar-level highlighting and code snippets.

### Language Server Features

| Feature | Description |
|-|-|
| Hover | Cell/surface summaries, ZAID element names, thermal S(a,b) tables |
| Go to Definition | Jump to cell, surface, or material definitions |
| Find All References | Locate every reference to a cell, surface, or material |
| Rename Symbol | Rename cells, surfaces, or materials across the file with validation |
| Document Symbols | Outline view of all cards and blocks |
| Workspace Symbols | Search for cards across open files |
| Code Actions | Quick fixes to create missing material, cell, or surface stubs |
| Completions | Context-aware IntelliSense for cell, surface, and data blocks |
| Signature Help | Surface card parameter names with active-parameter highlighting |
| Semantic Tokens | Highlighting for cell/surface/material IDs and keywords |
| Inlay Hints | ZAID element names and surface type mnemonics inline |
| Document Links | Clickable paths in READ FILE= cards |
| Code Lens | Reference counts displayed above definitions |
| Call Hierarchy | Navigate FILL/U universe nesting |
| Selection Ranges | Smart expand/shrink from token to card to block |
| Folding Ranges | Collapse blocks and multi-line cards |
| Document Formatting | CST-based formatter (Still in Testing) |

### Formatter [Still In Testing]

The formatter operates on a concrete syntax tree. Available as both an in-editor provider and a standalone CLI.

Key capabilities:

- Two presets: **default** (modern MCNP6 style) and **legacy** (80-column limit, `&` continuations)
- Aligns cell, surface, and material columns across consecutive cards
- Normalizes geometry spacing
- Converts between continuation styles (5-space indent vs `&`)
- Aligns tally bins, surface parameters, and inline comments
- Collapses excessive blank lines

## Configuration

All settings live under the `mcnpLinter` namespace. Stuff you might want to change:

| Setting | Default | Description |
|-|-|-|
| `dataPath` | `""` | Path to MCNP data directory (enables xsdir library lookup) |
| `debounceMs` | `500` | Validation debounce delay in milliseconds |
| `materialDisplay` | `"isotope"` | Hover display: `"isotope"` (U-235) or `"zaid"` (92235.80c) |
| `warnLineLength` | `false` | Warn when lines exceed 80 columns |
| `suppressChecks` | `[]` | Check numbers to suppress, e.g. `[4, 33]` |
| `formatter.preset` | `"default"` | `"default"` or future work (legacy) |

<details>
<summary>Full settings reference</summary>

**General**

| Setting | Type | Default | Description |
|-|-|-|-|
| `dataPath` | string | `""` | Path to MCNP cross-section data directory |
| `validateOnType` | boolean | `true` | Validate as you type |
| `debounceMs` | number | `500` | Validation debounce delay (ms) |
| `materialDisplay` | string | `"isotope"` | Hover display format: `"isotope"` or `"zaid"` |
| `resolveReadFiles` | boolean | `false` | Parse files referenced by READ cards |
| `asciiSurfaceArt` | boolean | `false` | Show ASCII surface art in hover |
| `warnLineLength` | boolean | `false` | Warn on lines exceeding 80 columns |
| `suppressChecks` | number[] | `[]` | Check numbers to suppress |

**Feature toggles**

| Setting | Type | Default | Description |
|-|-|-|-|
| `inlayHints.surfaceTypes` | boolean | `true` | Surface type mnemonics in cell geometry |
| `semanticTokens.enabled` | boolean | `true` | Semantic highlighting |
| `callHierarchy.enabled` | boolean | `true` | FILL/U universe call hierarchy |
| `selectionRanges.enabled` | boolean | `true` | Smart selection ranges |

**Formatter [Still In Testing]**

| Setting | Type | Default | Description |
|-|-|-|-|
| `formatter.preset` | string | `"default"` | `"default"` or `"legacy"` |
| `formatter.continuationStyle` | string | `"indent"` | `"indent"` or `"ampersand"` |
| `formatter.continuationIndent` | number | `5` | Continuation indent spaces (min 5) |
| `formatter.maxLineLength` | number | `0` | Max line length (0 = no wrapping, max 128) |
| `formatter.tabHandling` | string | `"convert"` | `"convert"` or `"preserve"` |
| `formatter.trimTrailingWhitespace` | boolean | `true` | Remove trailing whitespace |
| `formatter.alignCellColumns` | boolean | `true` | Align cell card columns |
| `formatter.normalizeGeometrySpacing` | boolean | `true` | Normalize geometry whitespace |
| `formatter.alignSurfaceColumns` | boolean | `true` | Align surface card columns |
| `formatter.alignSurfaceParameters` | boolean | `true` | Align surface parameters by type |
| `formatter.alignMaterialComponents` | boolean | `true` | Align ZAID/fraction columns |
| `formatter.materialComponentThreshold` | number | `3` | Components per line threshold |
| `formatter.alignTallyBins` | boolean | `true` | Align tally bin values |
| `formatter.keywordSpacing` | string | `"compact"` | `"compact"`, `"spaced"`, or `"preserve"` |
| `formatter.alignInlineComments` | boolean | `false` | Align inline `$` comments |
| `formatter.inlineCommentColumn` | number | `40` | Target column for comment alignment |
| `formatter.maxConsecutiveBlankLines` | number | `2` | Max consecutive blank lines within blocks |
| `formatter.lineEnding` | string | `"lf"` | `"lf"` or `"crlf"` |

</details>

## Requirements

- VS Code 1.82 or later
- For xsdir-based checks (17, 8): set `mcnpLinter.dataPath` to your MCNP data directory, whichever one has the xsdir file in it.

## Attributions
Icon made by afif fudin from [fa](https://www.flaticon.com)

## License

[MIT](LICENSE)
