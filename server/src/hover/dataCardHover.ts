/** Data card keyword descriptions. Verify against MCNP6.3 Manual §3.4.x. */
const DATA_CARD_DOCS: Record<string, string> = {
  'MODE': '**MODE** — Particle transport mode\n\nSpecifies which particle types to transport. Default: N (neutrons only).\n\nSyntax: `MODE p₁ p₂ ...`\n\nCommon: `MODE N` (neutron), `MODE N P` (neutron + photon), `MODE N P E` (+ electron)',
  'NPS': '**NPS** — Number of particle histories\n\nTerminates the problem after the specified number of source particles.\n\nSyntax: `NPS n`',
  'CTME': '**CTME** — Computer time cutoff\n\nTerminates the problem after the specified number of minutes.\n\nSyntax: `CTME t` (minutes)',
  'SDEF': '**SDEF** — General source definition\n\nDefines source particle characteristics using keyword=value pairs.\n\nCommon keywords: `CEL` (cell), `SUR` (surface), `ERG` (energy MeV), `POS` (position x y z), `DIR` (direction cosine), `VEC` (reference vector), `PAR` (particle type), `RAD` (radial distance), `AXS` (axis vector), `EXT` (extent along AXS), `WGT` (weight), `TR` (transform)\n\nDistribution refs: `KEY=Dn` uses distribution n (defined by SIn/SPn)',
  'KCODE': '**KCODE** — Criticality source\n\nParameters for a keff eigenvalue calculation.\n\nSyntax: `KCODE NSRCK RKK IKZ KCT`\n\n- NSRCK: neutrons per cycle\n- RKK: initial keff guess\n- IKZ: cycles to skip before accumulating\n- KCT: total number of cycles',
  'KSRC': '**KSRC** — Criticality source points\n\nInitial fission source locations for KCODE problems.\n\nSyntax: `KSRC x₁ y₁ z₁  x₂ y₂ z₂ ...`',
  'PHYS': '**PHYS** — Physics options\n\nControls physics models for each particle type.\n\nSyntax: `PHYS:p EMAX ...`',
  'CUT': '**CUT** — Particle cutoff options\n\nSets energy and time cutoffs for particle transport.\n\nSyntax: `CUT:p T E₁ E₂ ...`',
  'PRINT': '**PRINT** — Print table control\n\nControls which summary tables appear in the output file.\n\nSyntax: `PRINT [table₁ table₂ ...]`',
  'PRDMP': '**PRDMP** — Print/dump cycle control\n\nControls frequency of print, dump, and tally fluctuation chart.\n\nSyntax: `PRDMP NDP NDM MCT NDMP DMMP`',
  'RAND': '**RAND** — Random number generation\n\nControls the random number generator seed and stride.\n\nSyntax: `RAND GEN=n SEED=s STRIDE=k`',
  'VOID': '**VOID** — Void all materials\n\nReplaces all materials with void for geometry debugging.',
  'TOTNU': '**TOTNU** — Total fission neutron number\n\nUse total nu-bar (prompt + delayed) for fission neutrons.\n\nSyntax: `TOTNU [NO]`',
  'NONU': '**NONU** — Suppress fission neutrons\n\nTurn off fission neutron production.\n\nSyntax: `NONU [NO]`',
};

/** Tally type descriptions (§3.7.1). */
const TALLY_TYPE_DOCS: Record<number, string> = {
  1: '**F1** — Surface current tally\n\nIntegrated current across a surface (particles)',
  2: '**F2** — Surface flux tally\n\nAverage flux across a surface (particles/cm²)',
  4: '**F4** — Cell flux tally (track-length estimate)\n\nAverage flux in a cell (particles/cm²)',
  5: '**F5** — Point detector tally\n\nFlux at a point using next-event estimator (particles/cm²)',
  6: '**F6** — Energy deposition tally\n\nCollision heating in a cell (MeV/g)',
  7: '**F7** — Fission energy deposition\n\nFission heating in a cell (MeV/g) — neutrons only',
  8: '**F8** — Pulse height tally\n\nEnergy distribution of pulses in a detector cell',
};

/** Source distribution card descriptions (§3.4.7.2). */
const DIST_CARD_DOCS: Record<string, string> = {
  'SI': '**SI** — Source information\n\nDefines values for a source distribution.\n\nSyntax: `SIn [option] v₁ v₂ ...`\n\nOptions: H (histogram), L (discrete list), S (distribution of distributions), A (arbitrary)',
  'SP': '**SP** — Source probability\n\nDefines probabilities for a source distribution.\n\nSyntax: `SPn [option] p₁ p₂ ...`\n\nBuilt-in functions: -21 (Watt fission), -2 (Maxwell), -3 (Gaussian fusion), -4 (Watt w/param), -5 (evaporation)',
  'SB': '**SB** — Source bias\n\nDefines biasing probabilities for a source distribution.\n\nSyntax: `SBn [option] b₁ b₂ ...`',
  'DS': '**DS** — Dependent source distribution\n\nDefines a distribution dependent on another variable.\n\nSyntax: `DSn [option] v₁ v₂ ...`\n\nOptions: S (distribution), H (histogram), L (list), T (interpolation), Q (value)',
};

/**
 * Get hover documentation for a data card keyword.
 * Returns markdown string or undefined if not a recognized keyword.
 */
export function getDataCardHover(token: string): string | undefined {
  const upper = token.toUpperCase();

  // Direct keyword match
  if (DATA_CARD_DOCS[upper]) {
    return DATA_CARD_DOCS[upper];
  }

  // PHYS:X, CUT:X pattern
  const colonMatch = upper.match(/^(PHYS|CUT):([A-Z])$/);
  if (colonMatch && DATA_CARD_DOCS[colonMatch[1]]) {
    return DATA_CARD_DOCS[colonMatch[1]];
  }

  // Tally card: F4:N, *F5:P, etc.
  const tallyMatch = upper.match(/^[*+]?F(\d+)/);
  if (tallyMatch) {
    const tallyType = parseInt(tallyMatch[1], 10) % 10;
    if (TALLY_TYPE_DOCS[tallyType]) {
      return TALLY_TYPE_DOCS[tallyType];
    }
  }

  // SI/SP/SB/DS distribution cards
  const distMatch = upper.match(/^(SI|SP|SB|DS)\d+$/);
  if (distMatch && DIST_CARD_DOCS[distMatch[1]]) {
    return DIST_CARD_DOCS[distMatch[1]];
  }

  return undefined;
}
