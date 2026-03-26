import { SurfaceCard } from '../types';
import { LogicalLine } from './tokenizer';
import { getSurfaceType } from '../data/surfaceTypes';

/**
 * Parse an MCNP surface card from a logical line.
 *
 * Format: [modifier]j [n] A list
 *   modifier = optional '*' (reflecting) or '+' (white boundary)
 *   j        = surface number (integer)
 *   n        = optional transformation number (integer)
 *   A        = surface type mnemonic
 *   list     = numeric parameters
 */
export function parseSurfaceCard(line: LogicalLine): SurfaceCard {
  const tokens = line.text.trim().split(/\s+/);
  let idx = 0;

  if (tokens.length < 2) {
    throw new Error(`Surface card: insufficient tokens (need at least surface number and type mnemonic)`);
  }

  // Parse first token: optional modifier prefix attached to surface number
  let modifier: '*' | '+' | undefined;
  let firstToken = tokens[idx];

  if (firstToken.startsWith('*') || firstToken.startsWith('+')) {
    modifier = firstToken.startsWith('*') ? '*' : '+';
    firstToken = firstToken.slice(1);
  }

  const id = parseInt(firstToken, 10);
  idx++;

  // Next token: could be a transform number or the surface type mnemonic.
  // If it matches a known surface type, it's the mnemonic; otherwise it's a transform number.
  let transform: number | undefined;

  if (idx >= tokens.length) {
    throw new Error(`Surface card ${id}: missing surface type mnemonic`);
  }
  const secondToken = tokens[idx];

  if (getSurfaceType(secondToken)) {
    // It's the surface type mnemonic
  } else {
    // It's a transformation number
    transform = parseInt(secondToken, 10);
    idx++;
  }

  if (idx >= tokens.length) {
    throw new Error(`Surface card ${id}: missing surface type mnemonic`);
  }

  const type = tokens[idx].toUpperCase();
  idx++;

  // Remaining tokens are numeric parameters
  const parameters: number[] = [];
  for (; idx < tokens.length; idx++) {
    parameters.push(parseFloat(tokens[idx]));
  }

  return {
    id,
    type,
    parameters,
    transform,
    modifier,
    range: {
      startLine: line.startLine,
      startCol: 0,
      endLine: line.endLine,
      endCol: line.text.length,
    },
  };
}
