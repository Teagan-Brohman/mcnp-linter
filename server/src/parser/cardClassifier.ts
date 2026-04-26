import { getSurfaceType } from '../data/surfaceTypes';

export type CardClass = 'cell' | 'surface' | 'data' | 'unknown';

/**
 * Classify a single physical (non-comment, non-blank, non-continuation) line as
 * a cell, surface, or data card based on its leading tokens. Returns 'unknown'
 * when the heuristic can't decide.
 */
export function classifyCardLine(line: string): CardClass {
  const stripped = line.trim();
  if (!stripped) return 'unknown';

  // Data cards start with an alphabetic mnemonic (M1, F4:N, MODE, NPS, …).
  if (/^[A-Za-z*+]/.test(stripped)) return 'data';

  const tokens = stripped.split(/\s+/).slice(0, 5);
  if (tokens.length < 2) return 'unknown';

  // Cell shorthand: `<id> like <n> but ...`
  if (/^like$/i.test(tokens[1])) return 'cell';

  // Direct surface form: `<id> <mnemonic> ...`
  if (getSurfaceType(tokens[1])) return 'surface';

  // With TR: `<id> <tr_num> <mnemonic> ...`
  if (/^-?\d+$/.test(tokens[1]) && tokens[2] && getSurfaceType(tokens[2])) return 'surface';

  // Otherwise treat as cell (`<id> <mat> <density?> <geom> ...`).
  if (/^-?\d/.test(tokens[1])) return 'cell';

  return 'unknown';
}
