import { McnpDocument } from '../types';
import { UniverseMap, ChainLink } from '../analysis/universeMap';
import { DocumentIndex } from '../analysis/documentIndex';

interface CellHoverOptions {
  um?: UniverseMap;
  idx?: DocumentIndex;
}

/** Cell hover: universe assignment, nesting chain, and tally path syntax. */
export function getCellHover(
  doc: McnpDocument,
  cellId: number,
  options: CellHoverOptions = {},
): string | undefined {
  const { um, idx } = options;
  const cell = idx?.getCell(cellId) ?? doc.cells.find(c => c.id === cellId);
  if (!cell) return undefined;

  const resolvedUm = um ?? new UniverseMap(doc);
  const universe = resolvedUm.getCellUniverse(cellId) ?? 0;
  const fill = resolvedUm.getCellFill(cellId);
  const lat = resolvedUm.getCellLat(cellId);
  const chain = resolvedUm.getNestingChain(cellId);

  const lines: string[] = [];

  let header = `**Cell ${cellId}** — U=${universe}`;
  if (universe === 0) header += ' (real world)';
  lines.push(header);

  if (fill !== undefined) {
    lines.push('');
    lines.push(`FILL=${fill} — filled with universe ${fill}`);
  }

  if (lat !== undefined) {
    lines.push('');
    const latDesc = lat === 1 ? 'hexahedral (rectangular)' : lat === 2 ? 'hexagonal prism' : `type ${lat}`;
    lines.push(`LAT=${lat} — ${latDesc} lattice`);
  }

  // Only show nesting chain when nested (more than 1 link means cell has a parent)
  if (chain.length > 1) {
    lines.push('');
    lines.push('**Nesting chain:**');
    lines.push('');
    lines.push(formatChain(chain));

    const hasLattice = chain.some(link => link.lat !== undefined);
    if (hasLattice) {
      lines.push('');
      lines.push(`**Tally path (specific element):** \`(${formatTallyPath(chain, true)})\``);
      lines.push('');
      lines.push(`**Tally path (all instances):** \`(${formatTallyPath(chain, false)})\``);
    } else {
      lines.push('');
      lines.push(`**Tally path:** \`(${formatTallyPath(chain, false)})\``);
    }
  }

  return lines.join('\n');
}

/**
 * Format the nesting chain as a readable tree.
 * Chain goes from leaf to root, but we display root to leaf.
 */
function formatChain(chain: ChainLink[]): string {
  const reversed = [...chain].reverse();
  const parts: string[] = [];

  for (let i = 0; i < reversed.length; i++) {
    const link = reversed[i];
    const indent = '  '.repeat(i);
    let desc = `Cell ${link.cellId}: U=${link.universe}`;
    if (link.fill !== undefined) desc += `, FILL=${link.fill}`;
    if (link.lat !== undefined) {
      const latDesc = link.lat === 1 ? 'hexahedral' : link.lat === 2 ? 'hex prism' : `type ${link.lat}`;
      desc += `, LAT=${link.lat} (${latDesc})`;
    }
    parts.push(`${indent}${desc}`);
  }

  return parts.join('\n\n');
}

/**
 * Format the tally path syntax.
 * withIndices=true:  cellId<parentId[i j k]<grandparentId  (specific lattice element)
 * withIndices=false: cellId<parentId<grandparentId          (all instances)
 * Chain goes from leaf to root.
 */
function formatTallyPath(chain: ChainLink[], withIndices: boolean): string {
  if (chain.length <= 1) return String(chain[0]?.cellId ?? '');

  const parts: string[] = [];
  for (let i = 0; i < chain.length; i++) {
    const link = chain[i];
    if (i === 0) {
      parts.push(String(link.cellId));
    } else {
      if (withIndices && link.lat !== undefined) {
        parts.push(`${link.cellId}[i j k]`);
      } else {
        parts.push(String(link.cellId));
      }
    }
  }

  return parts.join('<');
}
