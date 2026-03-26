import { DocumentLink, Range } from 'vscode-languageserver/node';
import { McnpDocument } from '../types';
import { splitLines } from '../utils/text';

/**
 * Create document links for READ FILE= paths so they are clickable in the editor.
 * Each link spans just the filename portion and resolves relative to the base URI's directory.
 */
export function getDocumentLinks(
  doc: McnpDocument, text: string, baseUri: string
): DocumentLink[] {
  if (!doc.readCards || doc.readCards.length === 0) return [];

  const lines = splitLines(text);
  const links: DocumentLink[] = [];
  const fileRe = /FILE\s*=\s*(\S+)/i;

  // Extract the directory from the base URI (everything up to last '/')
  const lastSlash = baseUri.lastIndexOf('/');
  const baseDir = lastSlash >= 0 ? baseUri.substring(0, lastSlash) : baseUri;

  for (const rc of doc.readCards) {
    const lineIdx = rc.range.startLine;
    if (lineIdx >= lines.length) continue;

    const lineText = lines[lineIdx];
    const match = fileRe.exec(lineText);
    if (!match) continue;

    // match.index is the start of "FILE=...", match[1] is the filename
    // The filename starts at match.index + the length of "FILE=" portion
    const fullMatchStart = match.index!;
    const filenameStart = fullMatchStart + match[0].length - match[1].length;
    const filenameEnd = filenameStart + match[1].length;

    const range = Range.create(lineIdx, filenameStart, lineIdx, filenameEnd);
    const target = baseDir + '/' + rc.filename;

    links.push(DocumentLink.create(range, target));
  }

  return links;
}
