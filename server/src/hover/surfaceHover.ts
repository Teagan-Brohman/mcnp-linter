import { McnpDocument, SurfaceCard } from '../types';
import { getSurfaceType, getAcceptedParamCounts, getSurfaceAsciiArt } from '../data/surfaceTypes';
import { extractCardName } from '../analysis/lspUtils';

interface SurfaceHoverOptions {
  fileLines?: string[];
  preResolved?: SurfaceCard;
  asciiSurfaceArt?: boolean;
}

/**
 * Build a markdown hover string for a surface referenced in a cell card.
 * Returns undefined if the surface ID is not found in the document.
 */
export function getSurfaceHover(doc: McnpDocument, surfaceId: number, options: SurfaceHoverOptions = {}): string | undefined {
  const { fileLines = [], preResolved } = options;
  const surface = preResolved ?? doc.surfaces.find(s => s.id === surfaceId);
  if (!surface) {
    return undefined;
  }

  const typeInfo = getSurfaceType(surface.type);
  const mnemonic = surface.type.toUpperCase();
  const name = extractCardName(surface.range.startLine, surface.range.endLine, fileLines);

  const lines: string[] = [];

  // Header line
  const desc = typeInfo ? `${mnemonic} (${typeInfo.description})` : mnemonic;
  let header = name
    ? `**Surface ${surface.id}** — ${name} — ${desc}`
    : `**Surface ${surface.id}** — ${desc}`;
  if (surface.modifier === '*') {
    header += ' (reflecting)';
  } else if (surface.modifier === '+') {
    header += ' (white boundary)';
  }
  lines.push(header);

  // Transform info
  if (surface.transform !== undefined) {
    lines.push('');
    lines.push(`Transform: TR${surface.transform}`);
  }

  // Equation
  if (typeInfo) {
    lines.push('');
    lines.push(typeInfo.equation);
  }

  // Parameter table
  lines.push('');
  lines.push('| Param | Value |');
  lines.push('|-|-|');

  if (typeInfo) {
    for (let i = 0; i < surface.parameters.length; i++) {
      const paramName = i < typeInfo.paramNames.length ? typeInfo.paramNames[i] : `p${i + 1}`;
      lines.push(`| ${paramName} | ${surface.parameters[i]} |`);
    }
  } else {
    for (let i = 0; i < surface.parameters.length; i++) {
      lines.push(`| p${i + 1} | ${surface.parameters[i]} |`);
    }
  }

  // ASCII art
  if (options.asciiSurfaceArt) {
    const art = getSurfaceAsciiArt(mnemonic);
    if (art) {
      lines.push('');
      lines.push('```');
      lines.push(art);
      lines.push('```');
    }
  }

  return lines.join('\n');
}

/**
 * Build a markdown hover for a surface type mnemonic (e.g., CZ, RPP, SO).
 * Shows usage format, equation, and parameter descriptions.
 */
export function getSurfaceTypeHover(mnemonic: string, asciiArt?: boolean): string | undefined {
  const typeInfo = getSurfaceType(mnemonic);
  if (!typeInfo) return undefined;

  const upper = mnemonic.toUpperCase();
  const lines: string[] = [];

  lines.push(`**${upper}** — ${typeInfo.description}`);

  // Usage format
  const paramList = typeInfo.paramNames.join(' ');
  lines.push('');
  lines.push(`Usage: \`j ${upper} ${paramList}\``);

  const counts = getAcceptedParamCounts(upper);
  if (counts && counts.length > 1) {
    lines.push('');
    lines.push(`Accepts ${counts.join(' or ')} parameters`);
  }

  // Equation
  lines.push('');
  lines.push(typeInfo.equation);

  // Parameter table
  lines.push('');
  lines.push('| Param | Description |');
  lines.push('|-|-|');
  for (const name of typeInfo.paramNames) {
    lines.push(`| ${name} | |`);
  }

  // ASCII art
  if (asciiArt) {
    const art = getSurfaceAsciiArt(upper);
    if (art) {
      lines.push('');
      lines.push('```');
      lines.push(art);
      lines.push('```');
    }
  }

  return lines.join('\n');
}
