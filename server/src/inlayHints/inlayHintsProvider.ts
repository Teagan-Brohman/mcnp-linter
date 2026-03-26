import { InlayHint, InlayHintKind, Position } from 'vscode-languageserver/node';
import { McnpDocument } from '../types';
import { DocumentIndex } from '../analysis/documentIndex';
import { getElement } from '../data/elements';

export function getInlayHints(
  doc: McnpDocument,
  range: { start: { line: number }; end: { line: number } },
  _text: string,
  options: { idx?: DocumentIndex; showSurfaceTypes?: boolean } = {}
): InlayHint[] {
  const hints: InlayHint[] = [];
  const idx = options.idx;
  const showSurfaceTypes = options.showSurfaceTypes ?? true;

  // ZAID element labels on material cards
  for (const mat of doc.materials) {
    // Skip materials entirely outside the range
    if (mat.range.endLine < range.start.line || mat.range.startLine > range.end.line) continue;

    for (const comp of mat.components) {
      // Skip components outside the range
      if (comp.range.endLine < range.start.line || comp.range.startLine > range.end.line) continue;

      const el = getElement(comp.z);
      if (!el) continue;

      // Place hint after the fraction (not after the ZAID) so it doesn't
      // push the fraction text to the right and overlap subsequent tokens.
      const hintRange = comp.fractionRange ?? comp.range;
      const label = comp.a === 0 ? `${el.symbol}-nat` : `${el.symbol}-${comp.a}`;
      hints.push({
        position: Position.create(hintRange.endLine, hintRange.endCol),
        label: ` ${label}`,
        kind: InlayHintKind.Type,
        paddingLeft: true,
      });
    }
  }

  // Surface type labels in cell geometry
  if (idx && showSurfaceTypes) {
    for (const cell of doc.cells) {
      // Skip cells entirely outside the range
      if (cell.range.endLine < range.start.line || cell.range.startLine > range.end.line) continue;

      for (const ref of cell.geometry.surfaceRefs) {
        // Skip refs outside the range
        if (ref.range.endLine < range.start.line || ref.range.startLine > range.end.line) continue;

        const surface = idx.getSurface(ref.id);
        if (!surface) continue;

        hints.push({
          position: Position.create(ref.range.endLine, ref.range.endCol),
          label: ` ${surface.type}`,
          kind: InlayHintKind.Type,
          paddingLeft: true,
        });
      }
    }
  }

  return hints;
}
