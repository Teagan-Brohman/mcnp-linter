  # Changelog

  ## 1.1.0 — 2026-04-26

  ### Features
  - Status bar item showing xsdir load state (#4)
  - "Silence check #N" quick fix on every diagnostic + enum-typed `mcnpLinter.suppressChecks` setting (#3)
  - New setting `mcnpLinter.ignoreTemplatePlaceholders` (default true) lets `{key}` templated input files lint without false positives (#1)
  - Stray blank-line detection now identifies the *kind* of cards on each side and only flags separators that split a single block (#7)
  - New check #66: warn on uncommented line sandwiched between two comments (#2)

  ### Fixes
  - Tab characters now correctly count as blank columns for continuation detection (per MCNP §4.4)
  - Check #21 (duplicate tally) now correctly keys on tally NUMBER, not type+particle, matching MCNP §3.2.5.4 (#6)
  - FILL array universe IDs are no longer flagged as surface refs in tab-indented lattice arrays (#5, fixed by tab handling)

  ## 1.0.0
  - Initial release
