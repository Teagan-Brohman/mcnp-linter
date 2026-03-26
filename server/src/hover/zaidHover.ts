import { ZaidEntry, MaterialCard, McnpDocument } from '../types';
import { getElement } from '../data/elements';
import { getLibraryInfo } from '../data/libraryInfo';
import { XsdirData, XsdirEntry, getAvailableLibraries } from '../data/xsdirParser';

interface ResolvedLibrary {
  suffix: string;
  source: string;
}

/** All MCNP library default keywords, in display order. */
const LIBRARY_KEYWORDS = ['NLIB', 'PLIB', 'ELIB', 'HLIB', 'ALIB', 'SLIB'] as const;

function resolveLibrary(
  entry: ZaidEntry,
  parentMaterial: MaterialCard,
  doc: McnpDocument,
): ResolvedLibrary | undefined {
  // 1. Explicit suffix on the ZAID itself
  if (entry.library) {
    return { suffix: entry.library, source: 'explicit' };
  }

  // 2. Unsuffixed ZAIDs default to neutron library (NLIB) per MCNP conventions.
  const keyword = 'NLIB';

  // Try parent material keyword
  const parentValue = parentMaterial.keywords.get(keyword);
  if (parentValue) {
    return { suffix: parentValue, source: keyword };
  }

  // 3. M0 global defaults
  const m0 = doc.materials.find((m) => m.id === 0);
  if (m0) {
    const m0Value = m0.keywords.get(keyword);
    if (m0Value) {
      return { suffix: m0Value, source: `M0 ${keyword}` };
    }
  }

  return undefined;
}

/**
 * Generate hover text for a ZAID entry within a material card.
 */
export function getZaidHover(
  doc: McnpDocument,
  entry: ZaidEntry,
  parentMaterial: MaterialCard,
  options: { xsdirData?: XsdirData } = {},
): string {
  const { xsdirData } = options;
  const element = getElement(entry.z);
  if (!element) {
    return `**${entry.zaid}** — Unknown element (Z=${entry.z})`;
  }

  // Build isotope name line
  let nameLine: string;
  if (entry.a === 0) {
    nameLine = `**${entry.zaid}** — ${element.name} (natural)`;
  } else {
    nameLine = `**${entry.zaid}** — ${element.name}-${entry.a} (${element.symbol}-${entry.a})`;
  }

  // Resolve library
  const resolved = resolveLibrary(entry, parentMaterial, doc);
  if (!resolved) {
    return nameLine;
  }

  const libInfo = getLibraryInfo(resolved.suffix);

  const lines: string[] = [nameLine];

  // Look up xsdir entry for this specific ZAID + suffix
  let xsdirMatch: XsdirEntry | undefined;
  if (xsdirData) {
    const zaidKey = String(entry.z * 1000 + entry.a);
    const xsdirEntries = getAvailableLibraries(xsdirData, zaidKey);
    xsdirMatch = xsdirEntries.find(e => e.suffix === resolved.suffix);
  }

  // Data library line — prefer xsdir library name, fall back to hardcoded table
  const libraryName = xsdirMatch?.library || libInfo?.source;
  const particleType = libInfo?.particleType;
  if (libraryName) {
    let libLine = `**Data library:** ${libraryName} (.${resolved.suffix}`;
    if (particleType) libLine += `, ${particleType}`;
    libLine += ')';
    if (resolved.source !== 'explicit') {
      libLine += ` — via ${resolved.source}`;
    }
    lines.push('');
    lines.push(libLine);
  } else {
    let suffixLine = `**Suffix:** .${resolved.suffix}`;
    if (resolved.source !== 'explicit') {
      suffixLine += ` — via ${resolved.source}`;
    }
    lines.push('');
    lines.push(suffixLine);
  }

  // Temperature — prefer xsdir (actual), fall back to library table (nominal)
  if (xsdirMatch) {
    lines.push('');
    lines.push(`**Temperature:** ${xsdirMatch.temperature.toFixed(1)} K`);
  } else if (libInfo?.temperature) {
    lines.push('');
    lines.push(`**Temperature:** ${libInfo.temperature} (nominal)`);
  }

  // Show other library default keywords set on this material (or M0)
  const usedKeyword = resolved.source === 'explicit' ? undefined : resolved.source.replace('M0 ', '');
  const m0 = doc.materials.find((m) => m.id === 0);
  const otherLibs: string[] = [];
  for (const kw of LIBRARY_KEYWORDS) {
    if (kw === usedKeyword) continue;
    const val = parentMaterial.keywords.get(kw) ?? m0?.keywords.get(kw);
    if (val) {
      const src = parentMaterial.keywords.has(kw) ? '' : ' (M0)';
      otherLibs.push(`${kw}=.${val}${src}`);
    }
  }
  if (otherLibs.length > 0) {
    lines.push('');
    lines.push(`**Other library defaults:** ${otherLibs.join(', ')}`);
  }

  return lines.join('\n');
}
