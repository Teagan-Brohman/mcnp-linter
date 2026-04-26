import { McnpDocument, ParseError, CellParameterName, SdefKeyword } from '../types';
import { isValidZ, isPlausibleIsotope } from '../data/elements';
import { UniverseMap } from './universeMap';
import { XsdirData, getAvailableLibraries, formatAvailableLibraries } from '../data/xsdirParser';
import { getAcceptedParamCounts } from '../data/surfaceTypes';
import { suffixCharToParticleType } from '../data/libraryInfo';
import { DocumentIndex } from './documentIndex';
import { LEGACY_TO_ENDF8, ENDF8_TO_LEGACY } from '../data/sabAliases';
import { getAbundances } from '../data/abundances';
import { SURFACE_TALLY_TYPES, CELL_TALLY_TYPES, POINT_DETECTOR_TALLY, FISSION_ENERGY_TALLY } from '../data/tallyTypes';
import { suggestMatch } from '../utils/fuzzyMatch';

interface ValidationOptions {
  /** Parsed xsdir data for ZAID/library validation (checks 17, 8). */
  xsdirData?: XsdirData;
  /** Pre-built document index for O(1) entity lookups. */
  idx?: DocumentIndex;
  /** Universe map for FILL/LAT/U graph validation (checks 5a–5d, 15). */
  um?: UniverseMap;
  /** When true, emit check 50 warnings for lines exceeding 80 columns. */
  warnLineLength?: boolean;
  /** Check numbers to suppress — matching diagnostics are silently dropped. */
  suppressChecks?: number[];
}

/** Return the most common value in `counts`, or `defaultVal` if the map is empty. */
function mostCommonValue(counts: Map<number, number>, defaultVal: number): number {
  let best = defaultVal, bestN = 0;
  for (const [v, n] of counts) { if (n > bestN) { best = v; bestN = n; } }
  return best;
}

/** Check for duplicate IDs in a list of cards, returning errors for each duplicate. */
function checkDuplicates(
  items: { id: number; range: { startLine: number; startCol: number; endLine: number; endCol: number } }[],
  label: string,
  checkNumber: number,
): ParseError[] {
  const seen = new Map<number, number>();
  const errors: ParseError[] = [];
  for (const item of items) {
    const firstLine = seen.get(item.id);
    if (firstLine !== undefined) {
      errors.push({ message: `Duplicate ${label}${item.id} — first defined at line ${firstLine + 1}`, range: item.range, severity: 'error', checkNumber });
    } else {
      seen.set(item.id, item.range.startLine);
    }
  }
  return errors;
}

const RECOGNIZED_CELL_PARAMS: ReadonlySet<string> = new Set<CellParameterName>([
  'IMP', 'VOL', 'PWT', 'EXT', 'FCL', 'WWN', 'DXC', 'NONU', 'PD', 'ELPT',
  'COSY', 'BFLCL', 'UNC', 'FILL', '*FILL', 'U', 'LAT', 'TRCL', '*TRCL',
  'TMP', 'MAT', 'RHO',
]);

/** Checks 1–2, 5, 10, 14–15, 35, 51: cell geometry, material refs, universe/FILL/LAT, complement, identity. */
function validateCells(doc: McnpDocument, idx: DocumentIndex, um: UniverseMap): ParseError[] {
  const errors: ParseError[] = [];
  const { surfaceIds, materialIds, cellIds } = idx;
  const seenCells = new Map<number, number>();

  // Primary pass: per-cell checks in a single iteration
  for (const cell of doc.cells) {
    // 10. Cell number range
    if (cell.id < 1 || cell.id > 99999999) {
      errors.push({ message: `Cell ${cell.id} — number must be between 1 and 99,999,999`, range: cell.range, severity: 'error', checkNumber: 10 });
    }
    // 35. Duplicate cell number
    const firstLine = seenCells.get(cell.id);
    if (firstLine !== undefined) {
      errors.push({ message: `Duplicate cell ${cell.id} — first defined at line ${firstLine + 1}`, range: cell.range, severity: 'error', checkNumber: 35 });
    } else {
      seenCells.set(cell.id, cell.range.startLine);
    }
    // 1. Cell -> Surface references
    for (const ref of cell.geometry.surfaceRefs) {
      if (!surfaceIds.has(ref.id)) {
        errors.push({ message: `Surface ${ref.id} referenced in cell ${cell.id} is not defined`, range: ref.range, severity: 'error', checkNumber: 1 });
      }
    }
    // 14. Cell complement #N cross-reference
    if (cell.geometry.cellRefs) {
      for (const ref of cell.geometry.cellRefs) {
        if (!cellIds.has(ref.id)) {
          errors.push({ message: `Cell ${ref.id} referenced by complement #${ref.id} in cell ${cell.id} is not defined`, range: ref.range, severity: 'error', checkNumber: 14 });
        }
      }
    }
    if (cell.likeCell !== undefined) continue; // LIKE BUT inherits material/density
    // 2. Cell -> Material references
    if (cell.materialId > 0 && !materialIds.has(cell.materialId)) {
      errors.push({ message: `Material ${cell.materialId} referenced in cell ${cell.id} is not defined`, range: cell.range, severity: 'error', checkNumber: 2 });
    }
    // 2b. Void/density consistency
    if (cell.materialId === 0 && cell.density !== undefined) {
      errors.push({ message: `Void cell ${cell.id} should not have a density`, range: cell.range, severity: 'warning', checkNumber: 2 });
    }
    if (cell.materialId > 0 && cell.density === undefined) {
      errors.push({ message: `Cell ${cell.id} has material ${cell.materialId} but no density specified`, range: cell.range, severity: 'error', checkNumber: 2 });
    }
    // 5c. LAT value validation (must be 1 or 2)
    for (const [key, value] of cell.parameters) {
      if (key.toUpperCase() === 'LAT') {
        const latVal = parseInt(value, 10);
        if (latVal !== 1 && latVal !== 2) {
          errors.push({ message: `Cell ${cell.id} has LAT=${latVal} — must be 1 (hexahedral) or 2 (hexagonal)`, range: cell.range, severity: 'error', checkNumber: 5 });
        }
        break;
      }
    }
    // 5d/51. Array FILL validation — element count and universe existence
    if (cell.arrayFill) {
      const af = cell.arrayFill;
      let reversed = false;
      for (const [lo, hi] of af.ranges) {
        if (hi < lo) {
          errors.push({ message: `Cell ${cell.id} array FILL has reversed range ${lo}:${hi} — must be low:high`, range: cell.range, severity: 'error', checkNumber: 51 });
          reversed = true;
        }
      }
      if (!reversed) {
        const expected = af.ranges.reduce((acc, [lo, hi]) => acc * (hi - lo + 1), 1);
        if (af.universes.length !== expected) {
          errors.push({ message: `Cell ${cell.id} array FILL expects ${expected} universe entries (${af.ranges.map(([a,b]) => `${a}:${b}`).join(' \u00d7 ')}), got ${af.universes.length}`, range: cell.range, severity: 'error', checkNumber: 5 });
        }
        for (const u of af.universes) {
          if (u !== 0 && um.getUniverseCells(u).length === 0) {
            errors.push({ message: `Universe ${u} in array FILL of cell ${cell.id} is not defined`, range: cell.range, severity: 'error', checkNumber: 5 });
          }
        }
      }
    }
  }

  // Post-pass: checks that need the full universe graph
  // 5a. FILL references undefined universe
  for (const { cellId, universe } of um.getUndefinedFillUniverses()) {
    const cell = um.getCellCard(cellId);
    if (cell) errors.push({ message: `Universe ${universe} referenced by FILL in cell ${cellId} is not defined (no cells have U=${universe})`, range: cell.range, severity: 'error', checkNumber: 5 });
  }
  // 5b. LAT without FILL
  for (const cellId of um.getLatWithoutFill()) {
    const cell = um.getCellCard(cellId);
    if (cell) errors.push({ message: `Cell ${cellId} has LAT but no FILL — lattice cells must specify which universe fills them`, range: cell.range, severity: 'error', checkNumber: 5 });
  }
  // 15. Lattice must be alone in its universe (MCNP manual p.285)
  for (const { cellId, universe } of um.getLatticeNotAlone()) {
    const cell = um.getCellCard(cellId);
    if (cell) errors.push({ message: `Lattice cell ${cellId} (U=${universe}) must be alone in its universe — found ${um.getUniverseCells(universe).length} cells`, range: cell.range, severity: 'error', checkNumber: 15 });
  }
  return [
    ...errors,
    ...validateCellLikeBut(doc, idx),
    ...validateCellParameters(doc),
  ];
}

/** Checks 13, 52: LIKE BUT reference existence and cyclic chain detection. */
function validateCellLikeBut(doc: McnpDocument, idx: DocumentIndex): ParseError[] {
  const errors: ParseError[] = [];
  const { cellIds, materialIds } = idx;

  // 13. LIKE BUT referenced cell existence
  for (const cell of doc.cells) {
    if (cell.likeCell !== undefined && !cellIds.has(cell.likeCell)) {
      errors.push({ message: `Cell ${cell.id} uses LIKE ${cell.likeCell} BUT — cell ${cell.likeCell} is not defined`, range: cell.range, severity: 'error', checkNumber: 13 });
    }
  }
  // 52. LIKE BUT cyclic chain detection + inherited material validation
  for (const cell of doc.cells) {
    if (cell.likeCell === undefined) continue;

    const visited = new Set<number>();
    visited.add(cell.id);
    let current = cell.likeCell;

    while (current !== undefined) {
      if (visited.has(current)) {
        errors.push({
          message: `Cell ${cell.id} has circular LIKE BUT reference chain`,
          range: cell.range,
          severity: 'error',
          checkNumber: 52,
        });
        break;
      }
      visited.add(current);
      const target = idx.getCell(current);
      if (!target) break; // already caught by check 13
      if (target.likeCell === undefined) {
        // Reached the root cell — validate its material for this LIKE chain
        if (target.materialId > 0 && !materialIds.has(target.materialId)) {
          errors.push({
            message: `Cell ${cell.id} (via LIKE ${cell.likeCell} BUT) inherits undefined Material ${target.materialId}`,
            range: cell.range,
            severity: 'error',
            checkNumber: 2,
          });
        }
        break;
      }
      current = target.likeCell;
    }
  }
  return errors;
}

/** Checks 49, 53, 58–60: IMP vs MODE, IMP count, unrecognized params, TMP positive, IMP non-negative. */
function validateCellParameters(doc: McnpDocument): ParseError[] {
  const errors: ParseError[] = [];

  // 49. IMP vs MODE consistency (refactored to use data-block IMP)
  const modeParticles49 = doc.modeCards.length > 0
    ? doc.modeCards[0].particles
    : ['N'];

  // Build set of particles covered by data-block IMP cards
  const dataBlockImpParticles = new Set<string>();
  for (const imp of doc.impCards) {
    for (const p of imp.particles) {
      dataBlockImpParticles.add(p);
    }
  }

  // 53. IMP entry count vs cell count
  const nonLikeCellCount = doc.cells.filter(c => c.likeCell === undefined).length;
  for (const imp of doc.impCards) {
    if (imp.values.length !== nonLikeCellCount) {
      errors.push({
        message: `IMP:${imp.particles.join(',')} has ${imp.values.length} values but there are ${nonLikeCellCount} cells`,
        range: imp.range,
        severity: 'warning',
        checkNumber: 53,
      });
    }
  }

  // For particles NOT covered by data-block IMP, check cell-param IMP
  const uncoveredParticles = modeParticles49.filter(p => !dataBlockImpParticles.has(p));
  let checkImpPerCell = false;
  if (uncoveredParticles.length > 0) {
    const nonLikeCells = doc.cells.filter(c => c.likeCell === undefined);
    const cellsWithImp = nonLikeCells.filter(c =>
      [...c.parameters.keys()].some(k => k.startsWith('IMP:'))
    );
    // Only check if majority of cells use cell-param IMP
    checkImpPerCell = cellsWithImp.length > nonLikeCells.length / 2;
  }

  // 49, 58, 59, 60: Per-cell parameter checks
  for (const cell of doc.cells) {
    if (cell.likeCell !== undefined) continue;

    // 49. IMP vs MODE consistency
    if (checkImpPerCell) {
      const coveredParticles = new Set<string>();
      for (const key of cell.parameters.keys()) {
        if (key.startsWith('IMP:')) {
          const particlePart = key.substring(4);
          for (const p of particlePart.split(',')) {
            const trimmed = p.trim().toUpperCase();
            if (trimmed) coveredParticles.add(trimmed);
          }
        }
      }
      for (const mp of uncoveredParticles) {
        if (!coveredParticles.has(mp)) {
          errors.push({
            message: `Cell ${cell.id} has no IMP:${mp} — importance required for each particle in MODE (${modeParticles49.join(',')})`,
            range: cell.range,
            severity: 'warning',
            checkNumber: 49,
          });
        }
      }
    }

    // 58. Unrecognized cell parameter
    for (const key of cell.parameters.keys()) {
      const baseName = key.split(':')[0];
      if (!RECOGNIZED_CELL_PARAMS.has(baseName)) {
        const suggestion = suggestMatch(baseName, RECOGNIZED_CELL_PARAMS);
        const hint = suggestion ? ` — did you mean '${suggestion}'?` : '';
        errors.push({
          message: `Cell ${cell.id} has unrecognized parameter '${key}'${hint}`,
          range: cell.range,
          severity: 'warning',
          checkNumber: 58,
        });
      }
    }
    // 59. TMP must be positive
    const tmp = cell.parameters.get('TMP');
    if (tmp !== undefined) {
      const val = parseFloat(tmp);
      if (!isNaN(val) && val <= 0) {
        errors.push({
          message: `Cell ${cell.id} has TMP=${tmp} — temperature must be positive (in MeV)`,
          range: cell.range,
          severity: 'error',
          checkNumber: 59,
        });
      }
    }
    // 60. IMP values must be non-negative
    for (const [key, value] of cell.parameters) {
      if (key.startsWith('IMP:')) {
        const val = parseFloat(value);
        if (!isNaN(val) && val < 0) {
          errors.push({
            message: `Cell ${cell.id} has ${key}=${value} — importance must be non-negative`,
            range: cell.range,
            severity: 'error',
            checkNumber: 60,
          });
        }
      }
    }
  }
  return errors;
}

/** Checks 3–4, 11–12, 16–17, 46, 63–64: material ZAID validation, surface parameter counts, surface range. */
function validateMaterialsAndSurfaces(doc: McnpDocument, xsdirData?: XsdirData): ParseError[] {
  const errors: ParseError[] = [];

  for (const mat of doc.materials) {
    // 3 & 4. ZAID validation
    for (const entry of mat.components) {
      if (!isValidZ(entry.z)) {
        errors.push({ message: `ZAID ${entry.zaid} — Z=${entry.z} is not a valid element (must be 1-118)`, range: entry.range, severity: 'error', checkNumber: 3 });
        continue;
      }
      if (entry.a > 0) {
        let checkA = entry.a;
        if (checkA >= 400) {
          for (let m = 1; m <= 4; m++) {
            const candidate = checkA - 300 - m * 100;
            if (candidate > 0 && isPlausibleIsotope(entry.z, candidate)) { checkA = candidate; break; }
          }
        }
        if (!isPlausibleIsotope(entry.z, checkA)) {
          errors.push({ message: `ZAID ${entry.zaid} — no known isotope of Z=${entry.z} with A=${entry.a}`, range: entry.range, severity: 'warning', checkNumber: 4 });
        }
      }
    }
    // 11. Material number range
    if (mat.id < 0 || mat.id > 99999999) {
      errors.push({ message: `Material M${mat.id} — number must be between 0 and 99,999,999`, range: mat.range, severity: 'error', checkNumber: 11 });
    }
    // 12. Mixed atom/weight fractions
    if (mat.components.length >= 2) {
      let hasPositive = false, hasNegative = false;
      for (const entry of mat.components) {
        if (entry.fraction > 0) hasPositive = true;
        if (entry.fraction < 0) hasNegative = true;
      }
      if (hasPositive && hasNegative) {
        errors.push({ message: `Material M${mat.id} mixes atom fractions (positive) and weight fractions (negative) — all fractions must have the same sign`, range: mat.range, severity: 'error', checkNumber: 12 });
      }
    }
  }

  // 36–38. Duplicate surface / material / MT card numbers
  errors.push(...checkDuplicates(doc.surfaces, 'surface ', 36));
  errors.push(...checkDuplicates(doc.materials, 'material M', 37));
  errors.push(...checkDuplicates(doc.thermalCards, 'MT', 38));

  // 16. Surface parameter count validation
  for (const surf of doc.surfaces) {
    if (!surf.type) continue;
    const accepted = getAcceptedParamCounts(surf.type);
    if (!accepted) continue;
    const actual = surf.parameters.length;
    if (!accepted.includes(actual)) {
      const expected = accepted.length === 1 ? `${accepted[0]}` : accepted.join(' or ');
      errors.push({ message: `Surface ${surf.id} (${surf.type}) has ${actual} parameters — expected ${expected}`, range: surf.range, severity: 'warning', checkNumber: 16 });
    }
  }

  // 46. Surface number range
  for (const surf of doc.surfaces) {
    if (surf.id < 1 || surf.id > 99999999) {
      errors.push({
        message: `Surface ${surf.id} — number must be between 1 and 99,999,999`,
        range: surf.range,
        severity: 'error',
        checkNumber: 46,
      });
    }
  }

  // 33. Unused surface — defined but never referenced in any cell's geometry
  const referencedSurfaces = new Set<number>();
  for (const cell of doc.cells) {
    for (const ref of cell.geometry.surfaceRefs) {
      referencedSurfaces.add(ref.id);
    }
  }
  for (const surf of doc.surfaces) {
    if (!referencedSurfaces.has(surf.id)) {
      errors.push({
        message: `Surface ${surf.id} is defined but never referenced in any cell geometry (unused)`,
        range: surf.range,
        severity: 'warning',
        checkNumber: 33,
      });
    }
  }

  // 34. Unused material — defined but no cell uses it, no MT/FM/LIKE BUT MAT= references it
  const referencedMaterials = new Set<number>();
  for (const cell of doc.cells) {
    if (cell.materialId > 0) referencedMaterials.add(cell.materialId);
    // LIKE BUT cells can override material via MAT= keyword
    const matParam = cell.parameters.get('MAT');
    if (matParam) {
      const matId = parseInt(matParam, 10);
      if (!isNaN(matId) && matId > 0) referencedMaterials.add(matId);
    }
  }
  for (const tc of doc.thermalCards) {
    referencedMaterials.add(tc.id);
  }
  for (const mod of doc.tallyModifiers) {
    if (mod.materialRefs) {
      for (const matId of mod.materialRefs) referencedMaterials.add(matId);
    }
  }
  for (const mat of doc.materials) {
    if (!referencedMaterials.has(mat.id)) {
      errors.push({
        message: `Material ${mat.id} is defined but never referenced by any cell or MT card (unused)`,
        range: mat.range,
        severity: 'warning',
        checkNumber: 34,
      });
    }
  }

  // 39. Surface references undefined transform
  const definedTransforms = new Set(doc.transformCards.map(tr => tr.id));
  for (const surf of doc.surfaces) {
    if (surf.transform !== undefined && !definedTransforms.has(surf.transform)) {
      errors.push({ message: `Surface ${surf.id} references TR${surf.transform} which is not defined`, range: surf.range, severity: 'warning', checkNumber: 39 });
    }
    // 62. Surface transform number must be ≤ 999
    if (surf.transform !== undefined && surf.transform > 999) {
      errors.push({ message: `Surface ${surf.id} references TR${surf.transform} — surface transforms must use TR numbers 1–999`, range: surf.range, severity: 'error', checkNumber: 62 });
    }
  }

  // 40. Duplicate transform number
  errors.push(...checkDuplicates(doc.transformCards, 'TR', 40));
  // 61. Transform number range
  for (const tr of doc.transformCards) {
    if (tr.id < 1 || tr.id > 99999) {
      errors.push({ message: `TR${tr.id} — number must be between 1 and 99,999`, range: tr.range, severity: 'error', checkNumber: 61 });
    }
  }

  errors.push(...validateZaidEntries(doc, xsdirData));

  return errors;
}

/** Checks 17, 63, 64: ZAID library existence, elemental ZAID hints, missing fractions. */
function validateZaidEntries(doc: McnpDocument, xsdirData?: XsdirData): ParseError[] {
  const errors: ParseError[] = [];

  // 17. ZAID+suffix existence in xsdir
  if (xsdirData) {
    for (const mat of doc.materials) {
      for (const entry of mat.components) {
        let suffix: string | undefined = entry.library;
        if (!suffix) {
          const kwValue = mat.keywords.get('NLIB');
          if (!kwValue) continue;
          suffix = kwValue;
        }

        // 63. Elemental ZAID with xsdir — check if isotopic forms are available
        if (entry.a === 0) {
          const abundances = getAbundances(entry.z);
          if (abundances) {
            const available = abundances.filter(iso => {
              const isoKey = String(entry.z * 1000 + iso.a);
              const isoEntries = getAvailableLibraries(xsdirData, isoKey);
              return isoEntries.some(e => e.suffix === suffix);
            });
            if (available.length > 0) {
              const isoList = available.map(iso => `${entry.z * 1000 + iso.a}.${suffix}`).join(', ');
              errors.push({
                message: `Elemental ZAID ${entry.zaid} — expand to isotopic form (${isoList} available in xsdir)`,
                range: entry.range,
                severity: 'info',
                checkNumber: 63,
              });
              continue;
            }
          }
        }

        const zaidKey = String(entry.z * 1000 + entry.a);
        const xsdirEntries = getAvailableLibraries(xsdirData, zaidKey);
        if (xsdirEntries.length === 0) {
          errors.push({ message: `ZAID ${entry.zaid} not found in xsdir`, range: entry.range, severity: 'warning', checkNumber: 17 });
        } else if (!xsdirEntries.find(e => e.suffix === suffix)) {
          errors.push({ message: `ZAID ${entry.zaid} suffix .${suffix} not in xsdir — available: ${formatAvailableLibraries(xsdirEntries)}`, range: entry.range, severity: 'warning', checkNumber: 17 });
        }
      }
    }
  }

  // 63. Elemental ZAID info hint (no xsdir)
  if (!xsdirData) {
    for (const mat of doc.materials) {
      for (const entry of mat.components) {
        if (entry.a === 0 && getAbundances(entry.z)) {
          errors.push({
            message: `Elemental ZAID ${entry.zaid} — not supported by ENDF/B-VIII+ libraries; expand to isotopic form`,
            range: entry.range,
            severity: 'info',
            checkNumber: 63,
          });
        }
      }
    }
  }

  // 64. ZAID missing fraction
  for (const mat of doc.materials) {
    for (const entry of mat.components) {
      if (entry.fractionRange === undefined) {
        errors.push({
          message: `ZAID ${entry.zaid} in M${mat.id} has no fraction — each ZAID must be paired with a fraction value`,
          range: entry.range,
          severity: 'error',
          checkNumber: 64,
        });
      }
    }
  }

  return errors;
}

/** Checks 6–9: thermal card (MT) and S(a,b) naming validation. */
function validateThermal(
  doc: McnpDocument,
  idx: DocumentIndex,
  xsdirData?: XsdirData,
): ParseError[] {
  const errors: ParseError[] = [];
  const materialIds = idx.materialIds;

  // 6. MT → M existence check
  for (const tc of doc.thermalCards) {
    if (!materialIds.has(tc.id)) {
      errors.push({ message: `MT${tc.id} references material M${tc.id} which is not defined`, range: tc.range, severity: 'error', checkNumber: 6 });
    }
  }

  // 7. Library consistency within material
  for (const mat of doc.materials) {
    const byParticle = new Map<string, Set<string>>();
    for (const entry of mat.components) {
      if (!entry.library) continue;
      const lastChar = entry.library.slice(-1);
      if (!byParticle.has(lastChar)) byParticle.set(lastChar, new Set());
      byParticle.get(lastChar)!.add(entry.library);
    }
    for (const [pChar, libs] of byParticle) {
      if (libs.size < 2) continue;
      const sorted = [...libs].sort((a, b) => a.localeCompare(b));
      const pName = suffixCharToParticleType(pChar);
      const libList = sorted.length === 2
        ? `.${sorted[0]} and .${sorted[1]}`
        : sorted.slice(0, -1).map(s => `.${s}`).join(', ') + `, and .${sorted[sorted.length - 1]}`;
      errors.push({ message: `Material M${mat.id} mixes ${pName} data libraries: ${libList}`, range: mat.range, severity: 'warning', checkNumber: 7 });
    }
  }

  errors.push(...validateThermalTemperature(doc, idx, xsdirData));
  errors.push(...validateThermalNaming(doc, idx));

  return errors;
}

/** Check 8: MT/M temperature consistency. */
function validateThermalTemperature(
  doc: McnpDocument,
  idx: DocumentIndex,
  xsdirData?: XsdirData,
): ParseError[] {
  const errors: ParseError[] = [];

  for (const tc of doc.thermalCards) {
    const mat = idx.getMaterial(tc.id);
    if (!mat) continue;

    // Collect neutron suffixes and xsdir temperatures in a single pass
    const neutronSuffixes: string[] = [];
    const temps: number[] = [];
    for (const entry of mat.components) {
      if (!entry.library) continue;
      const lastChar = entry.library.slice(-1).toLowerCase();
      if (lastChar !== 'c' && lastChar !== 'd') continue;
      neutronSuffixes.push(entry.library);
      if (xsdirData) {
        const zaidKey = String(entry.z * 1000 + entry.a);
        const xsdirEntries = getAvailableLibraries(xsdirData, zaidKey);
        const match = xsdirEntries.find(e => e.suffix === entry.library);
        if (match) temps.push(match.temperature);
      }
    }
    if (neutronSuffixes.length === 0) continue;

    let neutronTemp: number | undefined;
    if (xsdirData && temps.length > 0) {
      const tempCounts = new Map<number, number>();
      for (const t of temps) { const r = Math.round(t); tempCounts.set(r, (tempCounts.get(r) || 0) + 1); }
      neutronTemp = mostCommonValue(tempCounts, temps[0]);
    }

    for (const table of tc.tables) {
      if (!table.suffix) continue;
      let warned = false;

      // xsdir-based check: compare actual temperatures
      if (xsdirData) {
        const sabEntries = getAvailableLibraries(xsdirData, table.identifier);
        const sabMatch = sabEntries.find(e => e.suffix === table.suffix);
        if (sabMatch) {
          if (neutronTemp !== undefined) {
            const sabTemp = Math.round(sabMatch.temperature);
            const tempDiff = Math.abs(sabTemp - neutronTemp);
            if (tempDiff > 5) {
              const severity = tempDiff > 500 ? 'warning' : 'info';
              errors.push({ message: `MT${tc.id} table ${table.name} is at ${sabMatch.temperature.toFixed(0)} K but M${tc.id} neutron data is at ${Math.round(neutronTemp)} K`, range: table.range, severity, checkNumber: 8 });
            }
          }
          warned = true;
        } else if (sabEntries.length > 0) {
          // Identifier exists in xsdir but this specific suffix doesn't
          errors.push({ message: `MT${tc.id} table ${table.name} not found in xsdir — available: ${formatAvailableLibraries(sabEntries)}`, range: table.range, severity: 'warning', checkNumber: 8 });
          warned = true;
        }
      }

      // Suffix-based fallback: compare temperature index (units digit).
      // In MCNP suffixes, the units digit encodes the temperature variant
      // within a library generation. Index 0 = room temp for all generations.
      if (!warned) {
        const sabNumMatch = table.suffix.match(/^(\d+)/);
        if (!sabNumMatch) continue;
        const sabTempIdx = parseInt(sabNumMatch[1], 10) % 10;
        const neutronIdxCounts = new Map<number, number>();
        for (const suf of neutronSuffixes) {
          const numMatch = suf.match(/^(\d+)/);
          if (!numMatch) continue;
          const tempIdx = parseInt(numMatch[1], 10) % 10;
          neutronIdxCounts.set(tempIdx, (neutronIdxCounts.get(tempIdx) || 0) + 1);
        }
        const bestIdx = mostCommonValue(neutronIdxCounts, 0);
        if (sabTempIdx !== bestIdx) {
          errors.push({ message: `MT${tc.id} table ${table.name} (.${table.suffix}) may be at a different temperature than M${tc.id} neutron data (.${neutronSuffixes[0]})`, range: table.range, severity: 'info', checkNumber: 8 });
        }
      }
    }
  }

  return errors;
}

/** Check 9: S(a,b) naming convention vs neutron data generation. */
function validateThermalNaming(
  doc: McnpDocument,
  idx: DocumentIndex,
): ParseError[] {
  const errors: ParseError[] = [];

  for (const tc of doc.thermalCards) {
    const mat = idx.getMaterial(tc.id);
    if (!mat) continue;

    // Determine dominant neutron library generation from tens digit of suffix
    const genCounts = new Map<number, number>(); // tens digit → count
    for (const entry of mat.components) {
      if (!entry.library) continue;
      const lastChar = entry.library.slice(-1).toLowerCase();
      if (lastChar !== 'c' && lastChar !== 'd') continue;
      const numMatch = entry.library.match(/^(\d+)/);
      if (!numMatch) continue;
      const tensDigit = Math.floor(parseInt(numMatch[1], 10) / 10);
      genCounts.set(tensDigit, (genCounts.get(tensDigit) || 0) + 1);
    }
    if (genCounts.size === 0) continue;

    // tens digit 0 → ENDF/B-VIII.0, 1 → ENDF/B-VIII.1 (both use new naming); 7 or 8 → legacy naming
    const dominantGen = mostCommonValue(genCounts, 0);
    const expectNew = dominantGen === 0 || dominantGen === 1;

    for (const table of tc.tables) {
      const id = table.identifier;
      if (expectNew && id in LEGACY_TO_ENDF8) {
        errors.push({ message: `MT${tc.id} uses legacy S(a,b) name '${id}' — consider '${LEGACY_TO_ENDF8[id]}' for ENDF/B-VIII consistency`, range: table.range, severity: 'warning', checkNumber: 9 });
      } else if (!expectNew && id in ENDF8_TO_LEGACY) {
        errors.push({ message: `MT${tc.id} uses ENDF/B-VIII S(a,b) name '${id}' — consider '${ENDF8_TO_LEGACY[id]}' for ENDF/B-VII consistency`, range: table.range, severity: 'warning', checkNumber: 9 });
      }
    }
  }

  return errors;
}

/** Checks 18–32: READ card diagnostic and tally validation. */
function validateTallies(doc: McnpDocument, idx: DocumentIndex): ParseError[] {
  const errors: ParseError[] = [];
  const surfaceIds = idx.surfaceIds;
  const cellIds = idx.cellIds;
  const materialIds = idx.materialIds;

  const tallyNumberSet = new Set(doc.tallyCards.map(t => t.tallyNumber));

  // 44. Tally particle vs MODE consistency
  const modeParticles = doc.modeCards.length > 0
    ? new Set(doc.modeCards[0].particles)
    : new Set(['N']); // default MODE is N

  for (const tally of doc.tallyCards) {
    if (!tally.particles) continue;
    const tallyParticles = tally.particles.split(',').map(p => p.trim().toUpperCase());
    for (const p of tallyParticles) {
      if (p && !modeParticles.has(p)) {
        errors.push({
          message: `Tally F${tally.tallyNumber} requests particle ${p}, which is not in MODE (${[...modeParticles].join(',')})`,
          range: tally.range,
          severity: 'warning',
          checkNumber: 44,
        });
      }
    }
  }

  // 18. READ card info diagnostic
  for (const rc of doc.readCards) {
    errors.push({ message: `READ FILE=${rc.filename} — external file not validated by linter`, range: rc.range, severity: 'warning', checkNumber: 18, deprecated: true });
  }

  // 19. Tally bin cross-reference
  for (const tally of doc.tallyCards) {
    if (tally.tallyType === POINT_DETECTOR_TALLY) continue; // point detectors
    for (const group of tally.bins) {
      for (const entry of group.entries) {
        if (SURFACE_TALLY_TYPES.has(tally.tallyType)) {
          if (!surfaceIds.has(entry.id)) {
            errors.push({ message: `Surface ${entry.id} referenced in F${tally.tallyNumber} tally does not exist`, range: entry.range, severity: 'error', checkNumber: 19 });
          }
        } else if (CELL_TALLY_TYPES.has(tally.tallyType)) {
          if (!cellIds.has(entry.id)) {
            errors.push({ message: `Cell ${entry.id} referenced in F${tally.tallyNumber} tally does not exist`, range: entry.range, severity: 'error', checkNumber: 19 });
          }
        }
      }
    }
  }

  // 20. F7 neutron-only
  for (const tally of doc.tallyCards) {
    if (tally.tallyType === FISSION_ENERGY_TALLY && tally.particles && !tally.particles.includes('N')) {
      errors.push({ message: `F7 tally (fission energy deposition) allows neutron only — got ${tally.particles}`, range: tally.range, severity: 'error', checkNumber: 20 });
    }
  }

  // 21. Duplicate tally number — per MCNP §3.2.5.4: tally numbers must be unique across
  // all F cards (e.g., F1:N and F1:P together are not allowed). Multiple tallies of the
  // same type and particle but different numbers (F4:N, F14:N, F104:N) are explicitly
  // permitted.
  const tallyNumberMap = new Map<number, { particles?: string }>();
  for (const tally of doc.tallyCards) {
    const existing = tallyNumberMap.get(tally.tallyNumber);
    if (existing) {
      errors.push({
        message: `Duplicate tally number F${tally.tallyNumber}:${tally.particles ?? ''} — already defined as F${tally.tallyNumber}:${existing.particles ?? ''}`,
        range: tally.range,
        severity: 'error',
        checkNumber: 21,
      });
    } else {
      tallyNumberMap.set(tally.tallyNumber, { particles: tally.particles });
    }
  }

  // 22–25. Modifier validation: tally existence, CF cell refs, SF/FS surface refs, FM material refs
  for (const mod of doc.tallyModifiers) {
    // 22. Modifier references existing tally
    if (mod.tallyNumber !== 0 && !tallyNumberSet.has(mod.tallyNumber)) {
      errors.push({ message: `${mod.cardType}${mod.tallyNumber} modifier but no F${mod.tallyNumber} tally defined`, range: mod.range, severity: 'warning', checkNumber: 22 });
    }
    // 23. CF cell flagging refs exist
    if (mod.cardType === 'CF' && mod.entityRefs) {
      for (const id of mod.entityRefs) {
        if (!cellIds.has(id)) {
          errors.push({ message: `CF${mod.tallyNumber} references cell ${id} which does not exist`, range: mod.range, severity: 'error', checkNumber: 23 });
        }
      }
    }
    // 24. SF/FS surface refs exist
    if ((mod.cardType === 'SF' || mod.cardType === 'FS') && mod.entityRefs) {
      for (const id of mod.entityRefs) {
        if (!surfaceIds.has(id)) {
          errors.push({ message: `${mod.cardType}${mod.tallyNumber} references surface ${id} which does not exist`, range: mod.range, severity: 'error', checkNumber: 24 });
        }
      }
    }
    // 25. FM material refs exist
    if (mod.cardType === 'FM' && mod.materialRefs) {
      for (const id of mod.materialRefs) {
        if (id !== 0 && !materialIds.has(id)) {
          errors.push({ message: `FM${mod.tallyNumber} references material M${id} which is not defined`, range: mod.range, severity: 'error', checkNumber: 25 });
        }
      }
    }
  }

  errors.push(...validateTallyModifiers(doc));

  // 48. F6/F7 tally in void cell
  const HEATING_TALLY_TYPES = new Set([6, 7]);
  for (const tally of doc.tallyCards) {
    if (!HEATING_TALLY_TYPES.has(tally.tallyType)) continue;
    for (const group of tally.bins) {
      for (const entry of group.entries) {
        const cell = idx.getCell(entry.id);
        if (cell && cell.materialId === 0) {
          errors.push({
            message: `F${tally.tallyNumber} (type ${tally.tallyType}) tallies cell ${entry.id} which is void — energy deposition tallies require a material`,
            range: entry.range,
            severity: 'warning',
            checkNumber: 48,
          });
        }
      }
    }
  }

  return errors;
}

/** Checks 26–32: tally modifier bin and count validations. */
function validateTallyModifiers(doc: McnpDocument): ParseError[] {
  const errors: ParseError[] = [];
  const tallyTypeMap = new Map<number, number>();
  for (const t of doc.tallyCards) tallyTypeMap.set(t.tallyNumber, t.tallyType);
  const modLookup = new Map<string, typeof doc.tallyModifiers[0]>();
  for (const mod of doc.tallyModifiers) modLookup.set(`${mod.cardType}:${mod.tallyNumber}`, mod);

  const numericCardTypes = new Set(['E', 'T', 'C', '*C', 'EM', 'TM', 'DE']);
  for (const mod of doc.tallyModifiers) {
    const ttype = tallyTypeMap.get(mod.tallyNumber);
    const nv = numericCardTypes.has(mod.cardType)
      ? mod.values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v))
      : [];

    // 26. E bins monotonically increasing
    if (mod.cardType === 'E') {
      for (let k = 1; k < nv.length; k++) {
        if (nv[k] <= nv[k - 1]) {
          errors.push({ message: `E${mod.tallyNumber} energy bins must be monotonically increasing — ${nv[k]} ≤ ${nv[k - 1]}`, range: mod.range, severity: 'error', checkNumber: 26 });
          break;
        }
      }
    }

    // 27. T bins monotonically increasing (skip keyword form)
    if (mod.cardType === 'T' && !mod.values.some(v => v.includes('='))) {
      for (let k = 1; k < nv.length; k++) {
        if (nv[k] <= nv[k - 1]) {
          errors.push({ message: `T${mod.tallyNumber} time bins must be monotonically increasing — ${nv[k]} ≤ ${nv[k - 1]}`, range: mod.range, severity: 'error', checkNumber: 27 });
          break;
        }
      }
    }

    // 28. C card type 1/2 only + last cosine must be 1
    if (mod.cardType === 'C' || mod.cardType === '*C') {
      if (ttype !== undefined && ttype !== 1 && ttype !== 2) {
        errors.push({ message: `C${mod.tallyNumber} cosine bins only valid for tally type 1 or 2 — F${mod.tallyNumber} is type ${ttype}`, range: mod.range, severity: 'error', checkNumber: 28 });
      }
      const cVals = mod.cardType === 'C' ? nv : [];
      if (cVals.length > 0 && cVals[cVals.length - 1] !== 1) {
        errors.push({ message: `C${mod.tallyNumber} last cosine bin must be 1 — got ${cVals[cVals.length - 1]}`, range: mod.range, severity: 'error', checkNumber: 28 });
      }
    }

    // 29. CM type 1/2 only
    if (mod.cardType === 'CM') {
      if (ttype !== undefined && ttype !== 1 && ttype !== 2) {
        errors.push({ message: `CM${mod.tallyNumber} cosine multiplier only valid for tally type 1 or 2`, range: mod.range, severity: 'error', checkNumber: 29 });
      }
    }

    // 30. EM count matches E count
    if (mod.cardType === 'EM') {
      const eMod = modLookup.get(`E:${mod.tallyNumber}`) || modLookup.get('E:0');
      if (eMod) {
        const eCount = eMod.values.filter(v => !isNaN(parseFloat(v))).length;
        if (nv.length !== eCount) {
          errors.push({ message: `EM${mod.tallyNumber} has ${nv.length} entries but E${eMod.tallyNumber} has ${eCount} energy bins`, range: mod.range, severity: 'error', checkNumber: 30 });
        }
      }
    }

    // 31. TM count matches T count
    if (mod.cardType === 'TM') {
      const tMod = modLookup.get(`T:${mod.tallyNumber}`) || modLookup.get('T:0');
      if (tMod) {
        const tCount = tMod.values.filter(v => !isNaN(parseFloat(v)) && !v.includes('=')).length;
        if (nv.length !== tCount) {
          errors.push({ message: `TM${mod.tallyNumber} has ${nv.length} entries but T${tMod.tallyNumber} has ${tCount} time bins`, range: mod.range, severity: 'error', checkNumber: 31 });
        }
      }
    }

    // 32. DE/DF count match
    if (mod.cardType === 'DE') {
      const dfMod = modLookup.get(`DF:${mod.tallyNumber}`);
      if (dfMod) {
        const dfNumeric = dfMod.values.filter(v => !isNaN(parseFloat(v))).length;
        if (nv.length !== dfNumeric) {
          errors.push({ message: `DE${mod.tallyNumber} has ${nv.length} entries but DF${mod.tallyNumber} has ${dfNumeric} — must match`, range: mod.range, severity: 'error', checkNumber: 32 });
        }
      }
    }
  }
  return errors;
}

/** Check 41: global problem-level validation. */
function validateGlobal(doc: McnpDocument, warnLineLength?: boolean): ParseError[] {
  const errors: ParseError[] = [];

  // Check 41: Missing NPS/CTME (KCODE problems terminate via cycle count)
  if (doc.npsCards.length === 0 && doc.ctmeCards.length === 0 && doc.kcodeCards.length === 0) {
    errors.push({
      message: 'No NPS or CTME card found — problem has no termination condition',
      range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
      severity: 'warning',
      checkNumber: 41,
    });
  }

  // Check 47: No source definition
  if (doc.sdefCards.length === 0 && doc.kcodeCards.length === 0) {
    errors.push({
      message: 'No SDEF or KCODE card found — problem has no source definition',
      range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
      severity: 'warning',
      checkNumber: 47,
    });
  }

  // Check 57: KSRC point count must be multiple of 3
  for (const ksrc of doc.ksrcCards) {
    if (ksrc.rawValueCount % 3 !== 0) {
      errors.push({
        message: `KSRC has ${ksrc.rawValueCount} values — must be a multiple of 3 (x y z triples)`,
        range: ksrc.range,
        severity: 'error',
        checkNumber: 57,
      });
    }
  }

  // Check 50: Line length > 80 columns (opt-in)
  if (warnLineLength && doc.originalLines) {
    for (let i = 0; i < doc.originalLines.length; i++) {
      const line = doc.originalLines[i];
      if (/^[cC](\s|$)/.test(line)) continue; // skip comments
      if (line.trim().length === 0) continue; // skip blank lines
      if (line.length > 80) {
        errors.push({
          message: `Line ${i + 1} is ${line.length} columns — exceeds 80-column limit`,
          range: { startLine: i, startCol: 80, endLine: i, endCol: line.length },
          severity: 'warning',
          checkNumber: 50,
        });
      }
    }
  }

  return errors;
}

const PAR_NUM_TO_LETTER: Record<string, string | undefined> = {
  '1': 'N', '2': 'P', '3': 'E', '9': 'H',
};

/** Check 42: SDEF distribution references and SI/SP count match. */
function validateSource(doc: McnpDocument, idx: DocumentIndex): ParseError[] {
  const errors: ParseError[] = [];
  if (doc.sdefCards.length === 0) return errors;

  const sdef = doc.sdefCards[0];

  // Build index of distribution cards
  const siMap = new Map<number, typeof doc.sourceDistCards[0]>();
  const spMap = new Map<number, typeof doc.sourceDistCards[0]>();
  for (const sd of doc.sourceDistCards) {
    if (sd.cardType === 'SI') siMap.set(sd.distNumber, sd);
    if (sd.cardType === 'SP') spMap.set(sd.distNumber, sd);
  }

  // Check 42a: Each Dn reference must have a corresponding SIn
  for (const [key, value] of sdef.keywords) {
    const distMatch = value.match(/^D(\d+)$/i);
    if (distMatch) {
      const distNum = parseInt(distMatch[1], 10);
      if (!siMap.has(distNum)) {
        errors.push({
          message: `SDEF ${key}=D${distNum} references distribution ${distNum}, but no SI${distNum} card found`,
          range: sdef.keywordRanges.get(key) ?? sdef.range,
          severity: 'error',
          checkNumber: 42,
        });
      }
    }
  }

  // Check 42b: SI/SP entry count mismatch
  for (const [distNum, si] of siMap) {
    const sp = spMap.get(distNum);
    if (sp && si.values.length !== sp.values.length) {
      // Skip for built-in SP functions (negative first value like -21)
      if (sp.values.length > 0 && parseFloat(sp.values[0]) < 0) {
        continue;
      }
      // Skip when SI count is exactly 3× SP count — vector-valued distributions
      // (e.g., SDEF POS=D1 with SI1 L x1 y1 z1 x2 y2 z2 ... and SP1 p1 p2 ...)
      if (si.values.length === sp.values.length * 3) {
        continue;
      }
      errors.push({
        message: `SI${distNum} has ${si.values.length} entries but SP${distNum} has ${sp.values.length} — counts should match (or 3:1 for vector variables like POS)`,
        range: sp.range,
        severity: 'warning',
        checkNumber: 42,
      });
    }
  }

  // Check 43: SDEF CEL/SUR references
  const celValue = sdef.keywords.get('CEL');
  if (celValue && !/^D\d+$/i.test(celValue)) {
    const celId = parseInt(celValue, 10);
    if (!isNaN(celId) && !idx.cellIds.has(celId)) {
      errors.push({
        message: `SDEF CEL=${celId} references undefined Cell ${celId}`,
        range: sdef.keywordRanges.get('CEL') ?? sdef.range,
        severity: 'error',
        checkNumber: 43,
      });
    }
  }

  const surValue = sdef.keywords.get('SUR');
  if (surValue && !/^D\d+$/i.test(surValue)) {
    const surId = parseInt(surValue, 10);
    if (!isNaN(surId) && !idx.surfaceIds.has(surId)) {
      errors.push({
        message: `SDEF SUR=${surId} references undefined Surface ${surId}`,
        range: sdef.keywordRanges.get('SUR') ?? sdef.range,
        severity: 'error',
        checkNumber: 43,
      });
    }
  }

  // Check 45: SDEF PAR vs MODE

  const parValue = sdef.keywords.get('PAR');
  if (parValue) {
    const modeParticles = doc.modeCards.length > 0
      ? new Set(doc.modeCards[0].particles)
      : new Set(['N']);

    let parLetter = parValue.toUpperCase();
    if (PAR_NUM_TO_LETTER[parValue]) {
      parLetter = PAR_NUM_TO_LETTER[parValue];
    }

    if (!modeParticles.has(parLetter)) {
      errors.push({
        message: `SDEF PAR=${parValue} specifies particle ${parLetter}, which is not in MODE (${[...modeParticles].join(',')})`,
        range: sdef.keywordRanges.get('PAR') ?? sdef.range,
        severity: 'warning',
        checkNumber: 45,
      });
    }
  }

  // Helper to check if a value is a distribution reference (Dn)
  const isDistRef = (v: string) => /^D\d+$/i.test(v);

  // Check 54: POS= needs exactly 3 values
  const posValue = sdef.keywords.get('POS');
  if (posValue && !isDistRef(posValue)) {
    const parts = posValue.trim().split(/\s+/);
    if (parts.length !== 3) {
      errors.push({
        message: `SDEF POS= has ${parts.length} value${parts.length === 1 ? '' : 's'} — expected 3 (x y z)`,
        range: sdef.keywordRanges.get('POS') ?? sdef.range,
        severity: 'error',
        checkNumber: 54,
      });
    }
  }

  // Check 55: AXS= and VEC= need exactly 3 values
  for (const kw of ['AXS', 'VEC'] as const satisfies readonly SdefKeyword[]) {
    const val = sdef.keywords.get(kw);
    if (val && !isDistRef(val)) {
      const parts = val.trim().split(/\s+/);
      if (parts.length !== 3) {
        errors.push({
          message: `SDEF ${kw}= has ${parts.length} value${parts.length === 1 ? '' : 's'} — expected 3 (x y z)`,
          range: sdef.keywordRanges.get(kw) ?? sdef.range,
          severity: 'error',
          checkNumber: 55,
        });
      }
    }
  }

  // Check 56: ERG= must be positive
  const ergValue = sdef.keywords.get('ERG');
  if (ergValue && !isDistRef(ergValue)) {
    const erg = parseFloat(ergValue);
    if (!isNaN(erg) && erg <= 0) {
      errors.push({
        message: `SDEF ERG=${ergValue} — energy must be positive`,
        range: sdef.keywordRanges.get('ERG') ?? sdef.range,
        severity: 'error',
        checkNumber: 56,
      });
    }
  }

  return errors;
}

/**
 * Validate cross-references between cells, surfaces, materials, and ZAIDs.
 */
export function validateCrossReferences(doc: McnpDocument, options: ValidationOptions = {}): ParseError[] {
  const xsdirData = options.xsdirData;
  const idx = options.idx ?? new DocumentIndex(doc);
  const um = options.um ?? new UniverseMap(doc);
  const suppress = options.suppressChecks;
  const allErrors = [
    ...validateCells(doc, idx, um),
    ...validateMaterialsAndSurfaces(doc, xsdirData),
    ...validateThermal(doc, idx, xsdirData),
    ...validateTallies(doc, idx),
    ...validateGlobal(doc, options.warnLineLength),
    ...validateSource(doc, idx),
  ];
  if (suppress && suppress.length > 0) {
    return allErrors.filter(e => e.checkNumber === undefined || !suppress.includes(e.checkNumber));
  }
  return allErrors;
}
