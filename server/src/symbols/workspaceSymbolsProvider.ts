import { SymbolInformation } from 'vscode-languageserver/node';
import { McnpDocument } from '../types';
import { DocumentIndex } from '../analysis/documentIndex';
import { getDocumentSymbols } from './documentSymbolsProvider';

export function getWorkspaceSymbols(
  query: string,
  documents: { uri: string; doc: McnpDocument; text: string; idx: DocumentIndex }[]
): SymbolInformation[] {
  const results: SymbolInformation[] = [];
  const lowerQuery = query.toLowerCase();

  for (const { uri, doc, text } of documents) {
    const symbols = getDocumentSymbols(doc, text);
    for (const sym of symbols) {
      if (lowerQuery.length === 0 || sym.name.toLowerCase().includes(lowerQuery)) {
        const container = sym.kind === 2 ? 'Cells'    // SymbolKind.Class (mapped to cells)
          : sym.kind === 11 ? 'Surfaces'               // SymbolKind.Interface
          : sym.kind === 13 ? 'Materials'               // SymbolKind.Variable
          : sym.kind === 24 ? 'Data'                    // SymbolKind.Event (thermal)
          : sym.kind === 12 ? 'Data'                    // SymbolKind.Function (tally)
          : undefined;
        results.push(
          SymbolInformation.create(
            sym.name,
            sym.kind,
            sym.range,
            uri,
            container
          )
        );
      }
    }
  }

  return results;
}
