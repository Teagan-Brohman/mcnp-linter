/**
 * Parser for MCNP xsdir (cross-section directory) files.
 * Extracts ZAID, suffix, AWR, and temperature for each table entry.
 */

import { SAB_ALIASES } from './sabAliases';

export interface XsdirEntry {
  zaid: string;       // e.g., "92235"
  suffix: string;     // e.g., "80c"
  awr: number;        // atomic weight ratio
  temperature: number; // in Kelvin
  library?: string;   // e.g., "Lib80x", "ENDF71x" — from "# Library:" comments
}

export interface XsdirData {
  entries: Map<string, XsdirEntry[]>; // keyed by ZAID (e.g., "92235")
}

const MEV_TO_KELVIN = 1 / 8.617333e-11;

import { splitLines } from '../utils/text';

/**
 * Parse an xsdir file's text content into structured data.
 */
export function parseXsdir(content: string): XsdirData {
  const entries = new Map<string, XsdirEntry[]>();
  const lines = splitLines(content);

  // Find the "directory" line (case-insensitive)
  let directoryIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().toLowerCase() === 'directory') {
      directoryIndex = i;
      break;
    }
  }

  if (directoryIndex < 0) {
    return { entries };
  }

  // Join continuation lines (lines ending with +) and process directory entries
  // Track "# Library:" comments to associate each entry with its library
  const directoryLines: { text: string; library?: string }[] = [];
  let currentLine = '';
  let currentLibrary: string | undefined;

  for (let i = directoryIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue;

    // Track library name from "# Library:" comments
    const libMatch = line.match(/^#\s*Library:\s*(.+)/i);
    if (libMatch) {
      currentLibrary = libMatch[1].trim();
      continue;
    }
    // Skip other comment lines
    if (line.startsWith('#')) continue;

    if (currentLine.length > 0) {
      // This is a continuation line
      currentLine += ' ' + line;
    } else {
      currentLine = line;
    }

    // Check if this line continues (ends with +)
    if (currentLine.endsWith('+')) {
      currentLine = currentLine.slice(0, -1).trim();
    } else {
      directoryLines.push({ text: currentLine, library: currentLibrary });
      currentLine = '';
    }
  }
  // Flush any remaining line
  if (currentLine.length > 0) {
    directoryLines.push({ text: currentLine, library: currentLibrary });
  }

  // Parse each directory entry
  for (const { text, library } of directoryLines) {
    const fields = text.split(/\s+/);
    if (fields.length < 2) continue;

    const zaidSuffix = fields[0];
    const dotIndex = zaidSuffix.indexOf('.');
    if (dotIndex < 0) continue;

    const zaid = zaidSuffix.substring(0, dotIndex);
    const suffix = zaidSuffix.substring(dotIndex + 1);
    const awr = parseFloat(fields[1]);

    if (isNaN(awr)) continue;

    // Temperature is the last numeric field in the entry (typically field 9,
    // but some older xsdir formats have fewer fields). Scan from the end to
    // find the temperature in MeV.
    let temperature = 293.6; // default room temperature
    for (let fi = fields.length - 1; fi >= 3; fi--) {
      const val = parseFloat(fields[fi]);
      if (!isNaN(val) && val > 0 && val < 1e-6) {
        // Plausible MeV temperature (room temp ~2.53e-8, max ~2e-7 for ~2500K)
        temperature = val * MEV_TO_KELVIN;
        break;
      }
    }

    const entry: XsdirEntry = { zaid, suffix, awr, temperature, library };

    const existing = entries.get(zaid);
    if (existing) {
      existing.push(entry);
    } else {
      entries.set(zaid, [entry]);
    }
  }

  return { entries };
}

/**
 * Get all available library entries for a given ZAID or S(a,b) identifier.
 * For S(a,b) identifiers, tries aliases if direct lookup fails.
 */
export function getAvailableLibraries(data: XsdirData, zaid: string): XsdirEntry[] {
  const direct = data.entries.get(zaid);
  if (direct && direct.length > 0) return direct;

  // Try S(a,b) aliases
  const aliases = SAB_ALIASES[zaid];
  if (aliases) {
    for (const alias of aliases) {
      const aliased = data.entries.get(alias);
      if (aliased && aliased.length > 0) return aliased;
    }
  }

  return [];
}

/**
 * Format xsdir entries into compact library-grouped ranges,
 * e.g. "ENDF80SaB2 .40t–.57t, ENDF70SaB .10t–.18t"
 */
export function formatAvailableLibraries(entries: { suffix: string; library?: string }[]): string {
  if (entries.length === 0) return '(none)';

  const byLib = new Map<string, string[]>();
  for (const e of entries) {
    const lib = e.library || 'unknown';
    let list = byLib.get(lib);
    if (!list) { list = []; byLib.set(lib, list); }
    list.push(e.suffix);
  }

  const parts: string[] = [];
  for (const [lib, suffixes] of byLib) {
    const nums = suffixes
      .map(s => { const m = s.match(/^(\d+)(\D+)$/); return m ? { num: parseInt(m[1], 10), letter: m[2], suffix: s } : null; })
      .filter((p): p is { num: number; letter: string; suffix: string } => p !== null)
      .sort((a, b) => a.num - b.num);

    if (nums.length === 0) { parts.push(`${lib} ${suffixes.map(s => '.' + s).join(', ')}`); continue; }

    const ranges: string[] = [];
    let start = nums[0], prev = nums[0];
    for (let i = 1; i <= nums.length; i++) {
      const cur = i < nums.length ? nums[i] : null;
      if (cur && cur.letter === prev.letter && cur.num === prev.num + 1) {
        prev = cur;
      } else {
        ranges.push(start.num === prev.num ? `.${start.suffix}` : `.${start.suffix}–.${prev.suffix}`);
        if (cur) { start = cur; prev = cur; }
      }
    }
    parts.push(`${lib} ${ranges.join(', ')}`);
  }

  return parts.join('; ');
}
