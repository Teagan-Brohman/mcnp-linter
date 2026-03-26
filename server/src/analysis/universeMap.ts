import { McnpDocument, CellCard, ArrayFill } from '../types';

export interface ChainLink {
  cellId: number;
  universe: number;      // Which universe this cell belongs to
  fill?: number;         // Which universe this cell is filled with
  lat?: number;          // Lattice type (1=hexahedral/cuboid, 2=hexagonal prism)
}

export class UniverseMap {
  // universe ID -> cell IDs belonging to it
  private universeToCells = new Map<number, Set<number>>();
  // cell ID -> universe it belongs to
  private cellToUniverse = new Map<number, number>();
  // cell ID -> universe it fills with (FILL=n)
  private cellToFill = new Map<number, number>();
  // cell ID -> lattice type
  private cellToLat = new Map<number, number>();
  // cell ID -> CellCard (for range lookups)
  private cellCards = new Map<number, CellCard>();
  // cell ID -> array FILL data
  private cellToArrayFill = new Map<number, ArrayFill>();

  constructor(doc: McnpDocument) {
    for (const cell of doc.cells) {
      this.cellCards.set(cell.id, cell);

      // Parse U parameter — default is 0 (real world)
      let universe = 0;
      const uParam = this.getParam(cell, 'U');
      if (uParam !== undefined) {
        universe = Math.abs(parseInt(uParam, 10));
      }
      this.cellToUniverse.set(cell.id, universe);

      if (!this.universeToCells.has(universe)) {
        this.universeToCells.set(universe, new Set<number>());
      }
      this.universeToCells.get(universe)!.add(cell.id);

      const fillParam = this.getParam(cell, 'FILL') ?? this.getParam(cell, '*FILL');
      if (fillParam !== undefined) {
        // FILL=n or FILL=n(transform) — extract leading integer
        const fillMatch = fillParam.match(/^(\d+)/);
        if (fillMatch) {
          this.cellToFill.set(cell.id, parseInt(fillMatch[1], 10));
        }
      }

      if (cell.arrayFill) {
        this.cellToArrayFill.set(cell.id, cell.arrayFill);
        // Ensure array-fill cells appear in cellToFill for LAT checks
        if (!this.cellToFill.has(cell.id) && cell.arrayFill.universes.length > 0) {
          this.cellToFill.set(cell.id, cell.arrayFill.universes[0]);
        }
      }

      const latParam = this.getParam(cell, 'LAT');
      if (latParam !== undefined) {
        this.cellToLat.set(cell.id, parseInt(latParam, 10));
      }
    }

    // Values are positional — index maps to cells in block order
    if (doc.parameterDataCards) {
      for (const pdc of doc.parameterDataCards) {
        for (let i = 0; i < pdc.values.length && i < doc.cells.length; i++) {
          const cell = doc.cells[i];
          const val = pdc.values[i];
          if (val === 0) continue; // 0 = not set

          switch (pdc.keyword) {
            case 'U': {
              // Only apply if cell doesn't have U on cell card
              const cellU = this.getParam(cell, 'U');
              if (cellU === undefined) {
                const oldUni = this.cellToUniverse.get(cell.id) ?? 0;
                this.universeToCells.get(oldUni)?.delete(cell.id);
                const newUni = Math.abs(val);
                this.cellToUniverse.set(cell.id, newUni);
                if (!this.universeToCells.has(newUni)) {
                  this.universeToCells.set(newUni, new Set<number>());
                }
                this.universeToCells.get(newUni)!.add(cell.id);
              }
              break;
            }
            case 'LAT': {
              const cellLat = this.getParam(cell, 'LAT');
              if (cellLat === undefined) {
                this.cellToLat.set(cell.id, val);
              }
              break;
            }
            case 'FILL': {
              const cellFill = this.getParam(cell, 'FILL') ?? this.getParam(cell, '*FILL');
              if (cellFill === undefined && !this.cellToFill.has(cell.id)) {
                this.cellToFill.set(cell.id, val);
              }
              break;
            }
          }
        }
      }
    }
  }

  /** Case-insensitive parameter lookup from cell's parameters map. */
  private getParam(cell: CellCard, key: string): string | undefined {
    const upper = key.toUpperCase();
    for (const [k, v] of cell.parameters) {
      if (k.toUpperCase() === upper) return v;
    }
    return undefined;
  }

  getCellUniverse(cellId: number): number | undefined {
    return this.cellToUniverse.get(cellId);
  }

  getUniverseCells(universe: number): number[] {
    return Array.from(this.universeToCells.get(universe) ?? []);
  }

  getCellFill(cellId: number): number | undefined {
    return this.cellToFill.get(cellId);
  }

  getCellLat(cellId: number): number | undefined {
    return this.cellToLat.get(cellId);
  }

  getCellArrayFill(cellId: number): ArrayFill | undefined {
    return this.cellToArrayFill.get(cellId);
  }

  getCellCard(cellId: number): CellCard | undefined {
    return this.cellCards.get(cellId);
  }

  /** Lattice cells that share a universe with other cells (invalid per manual). */
  getLatticeNotAlone(): { cellId: number; universe: number }[] {
    const result: { cellId: number; universe: number }[] = [];
    for (const [cellId] of this.cellToLat) {
      const universe = this.cellToUniverse.get(cellId);
      if (universe === undefined) continue;
      const peers = this.universeToCells.get(universe);
      if (peers && peers.size > 1) {
        result.push({ cellId, universe });
      }
    }
    return result;
  }

  /** All universe IDs that are referenced by FILL but have no cells. */
  getUndefinedFillUniverses(): { cellId: number; universe: number }[] {
    const result: { cellId: number; universe: number }[] = [];
    for (const [cellId, fillUni] of this.cellToFill) {
      if (!this.universeToCells.has(fillUni) || this.universeToCells.get(fillUni)!.size === 0) {
        result.push({ cellId, universe: fillUni });
      }
    }
    return result;
  }

  /** Cells with LAT but no FILL (invalid). */
  getLatWithoutFill(): number[] {
    const result: number[] = [];
    for (const [cellId] of this.cellToLat) {
      if (!this.cellToFill.has(cellId)) {
        result.push(cellId);
      }
    }
    return result;
  }

  /**
   * Build the nesting chain from a given cell up to the real world.
   * Returns array from leaf (the given cell) to root (real-world cell).
   */
  getNestingChain(cellId: number): ChainLink[] {
    const chain: ChainLink[] = [];
    const visited = new Set<number>();
    let currentCellId: number | undefined = cellId;

    while (currentCellId !== undefined) {
      if (visited.has(currentCellId)) break;
      visited.add(currentCellId);

      const universe = this.cellToUniverse.get(currentCellId);
      if (universe === undefined) break;

      const link: ChainLink = {
        cellId: currentCellId,
        universe,
        fill: this.cellToFill.get(currentCellId),
        lat: this.cellToLat.get(currentCellId),
      };
      chain.push(link);

      if (universe === 0) break;

      currentCellId = this.findFillParent(universe);
    }

    return chain;
  }

  /** Returns the first cell filling this universe; multiple parents are not tracked. */
  private findFillParent(universe: number): number | undefined {
    for (const [cellId, fillUni] of this.cellToFill) {
      if (fillUni === universe) return cellId;
    }
    return undefined;
  }
}

