# MCNP Linter

A Visual Studio Code language server for MCNP input files (`.i`, `.inp`, `.mcnp`).
Provides 62 cross-reference validation checks, 17 LSP features, and a CST-based formatter
that never changes input semantics.

## Installation

Search for **MCNP Linter** (`mcnp-community.mcnp-linter`) in the VS Code Extensions view,
or install from the command line:

```
code --install-extension mcnp-community.mcnp-linter
```

> **Companion extension** -- pair with
> [MCNP6 Syntax Highlighting and Snippets](https://marketplace.visualstudio.com/items?itemName=mcnp-community.mcnp)
> for grammar-level highlighting and code snippets.

## Features

### Validation

62 numbered checks run as you type, covering:

- **Cell/surface/material references** -- undefined, duplicate, and unused entity detection
- **ZAID validity** -- atomic number Z 1--118, plausible mass numbers, xsdir library lookup
- **Universe graph** -- FILL/LAT/U consistency, lattice cell isolation, reversed FILL ranges
- **Thermal S(a,b)** -- MT/M existence, library temperature consistency, naming conventions
- **Tallies** -- bin monotonicity, modifier cross-refs, particle vs MODE, F6/F7 in void cells
- **Source definitions** -- SDEF keyword validation, SI/SP/SB distribution refs, CEL/SUR refs
- **Global** -- missing NPS/CTME, missing source card, line length, KSRC point counts

Individual checks can be suppressed by number via `mcnpLinter.suppressChecks`.

<details>
<summary>Full validation check list</summary>

| # | Check | Severity |
|-|-|-|
| 1 | Cell references undefined surface | error |
| 2 | Cell references undefined material | error |
| 2b | Void cell with density or material cell without density | warning/error |
| 3 | Invalid atomic number Z (not 1--118) | error |
| 4 | Implausible isotope mass number | warning |
| 5a | FILL references undefined universe | error |
| 5b | LAT cell missing FILL | error |
| 5c | LAT value not in {1, 2} | error |
| 5d | Array FILL element count or undefined universe | error |
| 6 | MT card references undefined material | error |
| 7 | Inconsistent library suffixes within material | warning |
| 8 | MT/M temperature inconsistency (xsdir or suffix fallback) | warning |
| 9 | S(a,b) name vs neutron generation mismatch | warning |
| 10 | Cell number out of range 1--99,999,999 | error |
| 11 | Material number out of range 0--99,999,999 | error |
| 12 | Mixed atom/weight fractions in material | error |
| 13 | LIKE BUT references undefined cell | error |
| 14 | Cell complement #N references undefined cell | error |
| 15 | Lattice cell not alone in universe | error |
| 16 | Surface parameter count mismatch | warning |
| 17 | ZAID+suffix not found in xsdir | warning |
| 18 | READ card informational diagnostic | warning |
| 19 | Tally bin references undefined cell/surface | error |
| 20 | F7 tally restricted to neutrons | error |
| 21 | Duplicate tally type + particle combination | error |
| 22 | Tally modifier references undefined tally | warning |
| 23 | CF cell flagging references undefined cell | error |
| 24 | SF/FS surface flagging references undefined surface | error |
| 25 | FM material references undefined material | error |
| 26 | Energy bins not monotonically increasing | error |
| 27 | Time bins not monotonically increasing | error |
| 28 | Cosine bins invalid type or last value not 1 | error |
| 29 | CM cosine type not 1 or 2 | error |
| 30 | EM count does not match E bin count | error |
| 31 | TM count does not match T bin count | error |
| 32 | DE/DF bin count mismatch | error |
| 33 | Surface defined but never referenced | warning |
| 34 | Material defined but never referenced | warning |
| 35 | Duplicate cell number | error |
| 36 | Duplicate surface number | error |
| 37 | Duplicate material number | error |
| 38 | Duplicate MT card number | error |
| 39 | Surface references undefined transform | warning |
| 40 | Duplicate transform number | error |
| 41 | Missing NPS or CTME termination card | warning |
| 42 | SDEF distribution references undefined SI/SP | error |
| 43 | SDEF CEL/SUR references undefined cell/surface | error |
| 44 | Tally particle not in MODE card | warning |
| 45 | SDEF PAR particle not in MODE card | warning |
| 46 | Surface number out of range 1--99,999,999 | error |
| 47 | No source definition (SDEF or KCODE) | warning |
| 48 | F6/F7 tally bins reference void cell | warning |
| 49 | Cell missing IMP for particle in MODE | warning |
| 50 | Line exceeds 80 columns (opt-in) | warning |
| 51 | Array FILL reversed range (hi < lo) | error |
| 52 | LIKE BUT circular reference chain | error |
| 53 | IMP entry count vs cell count mismatch | warning |
| 54 | SDEF POS= requires 3 values | error |
| 55 | SDEF AXS=/VEC= requires 3 values | error |
| 56 | SDEF ERG= must be positive | error |
| 57 | KSRC point count not a multiple of 3 | error |
| 58 | Unrecognized cell parameter name | warning |
| 59 | TMP must be positive (MeV) | error |
| 60 | IMP values must be non-negative | error |
| 61 | Transform number out of range 1--99,999 | error |
| 62 | Surface transform must use TR 1--999 | error |

</details>

### Language Server Features

| Feature | Description |
|-|-|
| Hover | Cell/surface summaries, ZAID element names, thermal S(a,b) tables, optional ASCII surface art |
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
| Document Formatting | CST-based formatter (see below) |

### Formatter

The formatter operates on a concrete syntax tree and is guaranteed lossless -- it never
changes the meaning of your input. Available as both an in-editor provider and a standalone CLI.

Key capabilities:

- Two presets: **default** (modern MCNP6 style) and **legacy** (80-column limit, `&` continuations)
- Aligns cell, surface, and material columns across consecutive cards
- Normalizes geometry spacing
- Converts between continuation styles (5-space indent vs `&`)
- Aligns tally bins, surface parameters, and inline comments
- Collapses excessive blank lines

## Formatter CLI

The `mcnp-fmt` command can be used outside VS Code for batch formatting and CI checks.

```bash
# Format a file in place
npx mcnp-fmt input.i

# Check formatting without modifying (exits non-zero if changes needed)
npx mcnp-fmt --check input.i

# Format with a specific preset
npx mcnp-fmt --preset legacy input.i

# Read from stdin, write to stdout
cat input.i | npx mcnp-fmt --stdin
```

### `.mcnpfmt.json`

Place a `.mcnpfmt.json` file in your project root to configure formatting options.
The CLI and VS Code extension both read this file.

```json
{
  "preset": "default",
  "continuationStyle": "indent",
  "continuationIndent": 5,
  "maxLineLength": 0,
  "tabHandling": "convert",
  "trimTrailingWhitespace": true,
  "alignCellColumns": true,
  "normalizeGeometrySpacing": true,
  "alignSurfaceColumns": true,
  "alignMaterialComponents": true,
  "keywordSpacing": "compact"
}
```

Any option not specified falls back to the preset defaults.

## Configuration

All settings live under the `mcnpLinter` namespace. The most commonly changed settings:

| Setting | Default | Description |
|-|-|-|
| `dataPath` | `""` | Path to MCNP data directory (enables xsdir library lookup) |
| `debounceMs` | `500` | Validation debounce delay in milliseconds |
| `materialDisplay` | `"isotope"` | Hover display: `"isotope"` (U-235) or `"zaid"` (92235.80c) |
| `warnLineLength` | `false` | Warn when lines exceed 80 columns |
| `suppressChecks` | `[]` | Check numbers to suppress, e.g. `[4, 33]` |
| `formatter.preset` | `"default"` | `"default"` or `"legacy"` |

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

**Formatter**

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
- For xsdir-based checks (17, 8): set `mcnpLinter.dataPath` to your MCNP data directory

## License

[MIT](LICENSE)
