import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTag,
  Hover,
  MarkupKind,
  Location,
  TextEdit,
  CodeActionKind,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseInputFile } from './parser/inputFile';
import { validateCrossReferences } from './analysis/crossReference';
import { getHover } from './hover/hoverProvider';
import { getDefinition } from './definition/definitionProvider';
import { getDocumentSymbols } from './symbols/documentSymbolsProvider';
import { getWorkspaceSymbols } from './symbols/workspaceSymbolsProvider';
import { getFoldingRanges } from './folding/foldingProvider';
import { findReferences } from './references/referencesProvider';
import { prepareRename, getRenameEdits } from './rename/renameProvider';
import { getCodeActions } from './codeActions/codeActionProvider';
import { getCompletions } from './completion/completionProvider';
import { getInlayHints } from './inlayHints/inlayHintsProvider';
import { getDocumentLinks } from './links/documentLinksProvider';
import { getSignatureHelp } from './signatureHelp/signatureHelpProvider';
import { getCodeLenses } from './codeLens/codeLensProvider';
import { getSemanticTokens, TOKEN_TYPES, TOKEN_MODIFIERS } from './semanticTokens/semanticTokensProvider';
import { prepareCallHierarchy, getIncomingCalls, getOutgoingCalls } from './callHierarchy/callHierarchyProvider';
import { getSelectionRanges } from './selectionRange/selectionRangeProvider';
import { McnpDocument, ParseError } from './types';
import { DocumentIndex } from './analysis/documentIndex';
import { UniverseMap } from './analysis/universeMap';
import { parseXsdir, XsdirData } from './data/xsdirParser';
import { toRange } from './analysis/lspUtils';
import { normalizePath } from './utils/serverUtils';
import { formatToEdits } from './formatter/formatter';
import { FormatterConfig } from './formatter/config';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Document cache: parsed McnpDocument keyed by URI
const documentCache = new Map<string, McnpDocument>();
// DocumentIndex cache: keyed by URI, built alongside document
const indexCache = new Map<string, DocumentIndex>();
// UniverseMap cache: keyed by URI, built alongside DocumentIndex
const universeMapCache = new Map<string, UniverseMap>();

let validateOnType = true;
let debounceMs = 500;
let materialDisplay: 'isotope' | 'zaid' = 'isotope';
let dataPath = '';
let resolveReadFiles = false;
let asciiSurfaceArt = false;
let inlayHintSurfaceTypes = true;
let semanticTokensEnabled = true;
let callHierarchyEnabled = true;
let selectionRangesEnabled = true;
let codeLensEnabled = true;
let warnLineLength = false;
let suppressChecks: number[] = [];
let formatterConfig: Partial<FormatterConfig> = {};
let xsdirData: XsdirData | undefined;


/** Returns parsed XsdirData if found, or undefined (with console warnings for failures). */
function loadXsdir(path: string): XsdirData | undefined {
  if (!path) return undefined;
  const normalized = normalizePath(path);

  const candidates = ['xsdir_mcnp6.3', 'xsdir_mcnp6.2', 'xsdir_mcnp6.1', 'xsdir'];

  for (const name of candidates) {
    const xsdirPath = join(normalized, name);
    if (!existsSync(xsdirPath)) continue;
    try {
      return parseXsdir(readFileSync(xsdirPath, 'utf-8'));
    } catch (e) {
      connection.console.warn(`Failed to parse ${xsdirPath}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  connection.console.warn(`No usable xsdir file found in ${normalized} (tried: ${candidates.join(', ')})`);
  return undefined;
}

// Debounce timers keyed by URI
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Cursor line per URI — used to show CodeLens only for the entity under the cursor
const cursorLines = new Map<string, number>();

function toDiagnostic(error: ParseError): Diagnostic {
  const diag: Diagnostic = {
    range: toRange(error.range),
    severity:
      error.severity === 'error'
        ? DiagnosticSeverity.Error
        : error.severity === 'info'
          ? DiagnosticSeverity.Information
          : DiagnosticSeverity.Warning,
    source: 'mcnp-linter',
    message: error.message,
  };
  if (error.message.includes('(unused)')) {
    diag.tags = [DiagnosticTag.Unnecessary];
  }
  if (error.deprecated) {
    diag.tags = [...(diag.tags || []), DiagnosticTag.Deprecated];
  }
  return diag;
}

/**
 * Parse and validate a document, sending diagnostics to the client.
 */
function validateDocument(textDocument: TextDocument): void {
  const text = textDocument.getText();
  const uri = textDocument.uri;

  try {
    const doc = parseInputFile(text);

    if (resolveReadFiles && doc.readCards && doc.readCards.length > 0) {
      for (const rc of doc.readCards) {
        try {
          const basePath = fileURLToPath(textDocument.uri);
          const dir = dirname(basePath);
          const readPath = resolve(dir, rc.filename);
          const readText = readFileSync(readPath, 'utf-8');
          const readDoc = parseInputFile(readText);
          const readUri = pathToFileURL(readPath).toString();
          for (const cell of readDoc.cells) cell.sourceUri = readUri;
          for (const surf of readDoc.surfaces) surf.sourceUri = readUri;
          for (const mat of readDoc.materials) mat.sourceUri = readUri;
          for (const th of readDoc.thermalCards) th.sourceUri = readUri;
          doc.cells.push(...readDoc.cells);
          doc.surfaces.push(...readDoc.surfaces);
          doc.materials.push(...readDoc.materials);
          doc.thermalCards.push(...readDoc.thermalCards);
        } catch (e) {
          const cause = e instanceof Error ? e.message : String(e);
          doc.parseErrors.push({
            message: `READ FILE=${rc.filename} — ${cause}`,
            range: rc.range,
            severity: 'warning',
          });
        }
      }
    }

    const idx = new DocumentIndex(doc);
    documentCache.set(uri, doc);
    indexCache.set(uri, idx);
    universeMapCache.set(uri, new UniverseMap(doc));

    // Skip cross-reference validation when block structure is broken (stray blank
    // line splits cells/surfaces/data) to avoid cascading errors that bury the real problem
    const crossRefErrors = doc.hasBrokenBlockStructure
      ? []
      : validateCrossReferences(doc, {
          xsdirData, idx, um: universeMapCache.get(uri),
          warnLineLength, suppressChecks,
        });
    const allErrors: ParseError[] = [...doc.parseErrors, ...crossRefErrors];
    connection.sendDiagnostics({ uri, diagnostics: allErrors.map(toDiagnostic) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    connection.console.error(`Validation error for ${uri}: ${msg}`);
    connection.sendDiagnostics({ uri, diagnostics: [{
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      message: `Internal validation error: ${msg}`,
      severity: 1,
    }] });
  }
}

/**
 * Return cached document, index, and universe map for a URI, parsing and caching on first access.
 */
function ensureDocAndIndex(uri: string, text: string): [McnpDocument, DocumentIndex, UniverseMap] {
  let doc = documentCache.get(uri);
  let idx = indexCache.get(uri);
  let um = universeMapCache.get(uri);
  if (!doc || !idx || !um) {
    doc = parseInputFile(text);
    idx = new DocumentIndex(doc);
    um = new UniverseMap(doc);
    documentCache.set(uri, doc);
    indexCache.set(uri, idx);
    universeMapCache.set(uri, um);
  }
  return [doc, idx, um];
}

function invalidateUri(uri: string): void {
  documentCache.delete(uri);
  indexCache.delete(uri);
  universeMapCache.delete(uri);
  const timer = debounceTimers.get(uri);
  if (timer) {
    clearTimeout(timer);
    debounceTimers.delete(uri);
  }
}

/**
 * Shared handler: resolve document, run callback with parsed state, catch errors.
 * Returns `fallback` if the document is missing or the callback throws.
 */
function withDocument<T>(
  uri: string,
  label: string,
  fallback: T,
  fn: (text: string, doc: McnpDocument, idx: DocumentIndex, um: UniverseMap) => T
): T {
  const textDocument = documents.get(uri);
  if (!textDocument) return fallback;
  const text = textDocument.getText();
  try {
    const [doc, idx, um] = ensureDocAndIndex(uri, text);
    return fn(text, doc, idx, um);
  } catch (e) {
    connection.console.error(`${label} error: ${e instanceof Error ? e.message : String(e)}`);
    return fallback;
  }
}

// --- Settings ---

/** Read a boolean from a nested settings object (e.g. `s.semanticTokens.enabled`). */
function nestedBool(parent: unknown, key: string): boolean | undefined {
  if (parent && typeof parent === 'object') {
    const val = (parent as Record<string, unknown>)[key];
    if (typeof val === 'boolean') return val;
  }
  return undefined;
}

/** Parse formatter sub-settings into a partial FormatterConfig. */
function parseFormatterSettings(f: Record<string, unknown>): Partial<FormatterConfig> {
  const fc: Partial<FormatterConfig> = {};
  if (f.preset === 'default' || f.preset === 'legacy') fc.preset = f.preset;
  if (f.continuationStyle === 'indent' || f.continuationStyle === 'ampersand') fc.continuationStyle = f.continuationStyle;
  if (typeof f.continuationIndent === 'number') fc.continuationIndent = f.continuationIndent;
  if (typeof f.maxLineLength === 'number') fc.maxLineLength = f.maxLineLength;
  if (f.tabHandling === 'convert' || f.tabHandling === 'preserve') fc.tabHandling = f.tabHandling;
  if (typeof f.trimTrailingWhitespace === 'boolean') fc.trimTrailingWhitespace = f.trimTrailingWhitespace;
  if (typeof f.alignCellColumns === 'boolean') fc.alignCellColumns = f.alignCellColumns;
  if (typeof f.normalizeGeometrySpacing === 'boolean') fc.normalizeGeometrySpacing = f.normalizeGeometrySpacing;
  if (typeof f.alignSurfaceColumns === 'boolean') fc.alignSurfaceColumns = f.alignSurfaceColumns;
  if (typeof f.alignMaterialComponents === 'boolean') fc.alignMaterialComponents = f.alignMaterialComponents;
  if (typeof f.materialComponentThreshold === 'number') fc.materialComponentThreshold = f.materialComponentThreshold;
  if (typeof f.alignSurfaceParameters === 'boolean') fc.alignSurfaceParameters = f.alignSurfaceParameters;
  if (typeof f.alignTallyBins === 'boolean') fc.alignTallyBins = f.alignTallyBins;
  if (typeof f.maxConsecutiveBlankLines === 'number') fc.maxConsecutiveBlankLines = f.maxConsecutiveBlankLines;
  if (f.lineEnding === 'lf' || f.lineEnding === 'crlf') fc.lineEnding = f.lineEnding;
  if (f.keywordSpacing === 'compact' || f.keywordSpacing === 'spaced' || f.keywordSpacing === 'preserve') fc.keywordSpacing = f.keywordSpacing;
  if (typeof f.alignInlineComments === 'boolean') fc.alignInlineComments = f.alignInlineComments;
  if (typeof f.inlineCommentColumn === 'number') fc.inlineCommentColumn = f.inlineCommentColumn;
  return fc;
}

/** Apply settings from an options/config object. Returns true if dataPath changed. */
function applySettings(s: Record<string, unknown>): boolean {
  if (typeof s.validateOnType === 'boolean') validateOnType = s.validateOnType;
  if (typeof s.debounceMs === 'number') debounceMs = s.debounceMs;
  if (s.materialDisplay === 'isotope' || s.materialDisplay === 'zaid') materialDisplay = s.materialDisplay;
  if (typeof s.resolveReadFiles === 'boolean') resolveReadFiles = s.resolveReadFiles;
  if (typeof s.asciiSurfaceArt === 'boolean') asciiSurfaceArt = s.asciiSurfaceArt;
  if (Array.isArray(s.suppressChecks)) {
    suppressChecks = s.suppressChecks.filter((n): n is number => typeof n === 'number');
  }
  const st = nestedBool(s.semanticTokens, 'enabled');
  if (st !== undefined) semanticTokensEnabled = st;
  const ch = nestedBool(s.callHierarchy, 'enabled');
  if (ch !== undefined) callHierarchyEnabled = ch;
  const sr = nestedBool(s.selectionRanges, 'enabled');
  if (sr !== undefined) selectionRangesEnabled = sr;
  const cl = nestedBool(s.codeLens, 'enabled');
  if (cl !== undefined) codeLensEnabled = cl;
  inlayHintSurfaceTypes = nestedBool(s.inlayHints, 'surfaceTypes') ?? inlayHintSurfaceTypes;
  if (typeof s.warnLineLength === 'boolean') warnLineLength = s.warnLineLength;
  // Formatter settings (nested under s.formatter)
  if (s.formatter && typeof s.formatter === 'object') {
    formatterConfig = parseFormatterSettings(s.formatter as Record<string, unknown>);
  }
  if (typeof s.dataPath === 'string' && s.dataPath !== dataPath) {
    dataPath = s.dataPath;
    return true;
  }
  return false;
}

// --- Initialization ---

connection.onInitialize((params: InitializeParams): InitializeResult => {
  if (params.initializationOptions) {
    applySettings(params.initializationOptions);
  }
  xsdirData = loadXsdir(dataPath);

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      definitionProvider: true,
      documentSymbolProvider: true,
      foldingRangeProvider: true,
      referencesProvider: true,
      renameProvider: { prepareProvider: true },
      workspaceSymbolProvider: true,
      codeActionProvider: { codeActionKinds: [CodeActionKind.QuickFix, CodeActionKind.Refactor] },
      completionProvider: { triggerCharacters: ['#', '=', ' '] },
      signatureHelpProvider: { triggerCharacters: [' '] },
      semanticTokensProvider: {
        legend: { tokenTypes: TOKEN_TYPES, tokenModifiers: TOKEN_MODIFIERS },
        full: true,
      },
      inlayHintProvider: true,
      documentLinkProvider: {},
      codeLensProvider: {},
      callHierarchyProvider: true,
      selectionRangeProvider: true,
      documentFormattingProvider: true,
      documentRangeFormattingProvider: true,
    },
  };
});

connection.onDidChangeConfiguration((change) => {
  const settings = change.settings?.mcnpLinter;
  if (settings && applySettings(settings)) {
    xsdirData = loadXsdir(dataPath);
  }
  documents.all().forEach(validateDocument);
});

// --- Document events ---

documents.onDidChangeContent((change) => {
  const uri = change.document.uri;
  invalidateUri(uri);

  if (validateOnType) {
    const timer = setTimeout(() => {
      debounceTimers.delete(uri);
      validateDocument(change.document);
    }, debounceMs);
    debounceTimers.set(uri, timer);
  }
});

documents.onDidSave((change) => {
  // Always validate on save
  validateDocument(change.document);
});

documents.onDidClose((event) => {
  const uri = event.document.uri;
  invalidateUri(uri);
  cursorLines.delete(uri);
  connection.sendDiagnostics({ uri, diagnostics: [] });
});

// --- Cursor tracking (for cursor-aware CodeLens) ---

connection.onNotification('mcnp/cursorPosition', (params: { uri: string; line: number }) => {
  const prev = cursorLines.get(params.uri);
  cursorLines.set(params.uri, params.line);
  if (prev !== params.line) {
    void connection.sendRequest('workspace/codeLens/refresh').catch((e) => {
      connection.console.warn(`codeLens/refresh failed: ${e instanceof Error ? e.message : String(e)}`);
    });
  }
});

// --- Hover ---

connection.onHover((params): Hover | null => {
  return withDocument(params.textDocument.uri, 'Hover', null, (text, doc, idx, um) => {
    const result = getHover(doc, params.position, text, { materialDisplay, xsdirData, idx, um, asciiSurfaceArt });
    if (!result) return null;
    return { contents: { kind: MarkupKind.Markdown, value: result } };
  });
});

// --- Definition ---

connection.onDefinition((params) => {
  const uri = params.textDocument.uri;
  return withDocument(uri, 'Definition', null, (text, doc, idx, um) => {
    const result = getDefinition(doc, params.position, text, { idx, um });
    if (!result) return null;
    return Location.create(result.uri ?? uri, toRange(result.range));
  });
});

// --- Document Symbols ---

connection.onDocumentSymbol((params) => {
  return withDocument(params.textDocument.uri, 'DocumentSymbol', null, (text, doc) => {
    return getDocumentSymbols(doc, text);
  });
});

// --- Folding Ranges ---

connection.onFoldingRanges((params) => {
  return withDocument(params.textDocument.uri, 'FoldingRange', null, (_text, doc) => {
    return getFoldingRanges(doc);
  });
});

// --- References ---

connection.onReferences((params) => {
  const uri = params.textDocument.uri;
  return withDocument(uri, 'References', null, (text, doc, idx) => {
    const ranges = findReferences(doc, params.position, text, {
      idx,
      includeDeclaration: params.context.includeDeclaration,
    });
    return ranges.map(r => Location.create(uri, toRange(r)));
  });
});

// --- Rename ---

connection.onPrepareRename((params) => {
  return withDocument(params.textDocument.uri, 'PrepareRename', null, (text, doc, idx) => {
    const result = prepareRename(doc, params.position, text, { idx });
    if (!result) return null;
    return { range: toRange(result.range), placeholder: result.placeholder };
  });
});

connection.onRenameRequest((params) => {
  const uri = params.textDocument.uri;
  return withDocument(uri, 'Rename', null, (text, doc, idx) => {
    const edits = getRenameEdits(doc, params.position, text, params.newName, { idx });
    if (edits.length === 0) return null;
    const changes: { [uri: string]: TextEdit[] } = {};
    changes[uri] = edits.map(e => TextEdit.replace(toRange(e.range), e.newText));
    return { changes };
  });
});

// --- Workspace Symbols ---

connection.onWorkspaceSymbol((params) => {
  try {
    const entries = documents.all().map(td => {
      const text = td.getText();
      const [doc, idx] = ensureDocAndIndex(td.uri, text);
      return { uri: td.uri, doc, text, idx };
    });
    return getWorkspaceSymbols(params.query, entries);
  } catch (e) {
    connection.console.error(`WorkspaceSymbol error: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
});

// --- Code Actions ---

connection.onCodeAction((params) => {
  const uri = params.textDocument.uri;
  return withDocument(uri, 'CodeAction', null, (text, doc) => {
    return getCodeActions(doc, params.context.diagnostics, text, uri, params.range);
  });
});

// --- Completion ---

connection.onCompletion((params) => {
  return withDocument(params.textDocument.uri, 'Completion', null, (text, doc, idx) => {
    return getCompletions(doc, params.position, text, { idx, xsdirData });
  });
});

// --- Signature Help ---

connection.onSignatureHelp((params) => {
  return withDocument(params.textDocument.uri, 'SignatureHelp', null, (text, doc, idx) => {
    return getSignatureHelp(doc, params.position, text, { idx }) ?? null;
  });
});

// --- Inlay Hints ---

connection.languages.inlayHint.on((params) => {
  return withDocument(params.textDocument.uri, 'InlayHint', null, (text, doc, idx) => {
    return getInlayHints(doc, params.range, text, { idx, showSurfaceTypes: inlayHintSurfaceTypes });
  });
});

// --- Document Links ---

connection.onDocumentLinks((params) => {
  const uri = params.textDocument.uri;
  return withDocument(uri, 'DocumentLink', null, (text, doc) => {
    return getDocumentLinks(doc, text, uri);
  });
});

// --- Code Lens ---

connection.onCodeLens((params) => {
  if (!codeLensEnabled) return null;
  const uri = params.textDocument.uri;
  const cursorLine = cursorLines.get(uri);
  return withDocument(uri, 'CodeLens', null, (text, doc) => {
    return getCodeLenses(doc, text, uri, { cursorLine });
  });
});

// --- Semantic Tokens ---

connection.languages.semanticTokens.on((params) => {
  const empty = { data: [] as number[] };
  if (!semanticTokensEnabled) return empty;
  return withDocument(params.textDocument.uri, 'SemanticTokens', empty, (text, doc) => {
    return getSemanticTokens(doc, text).build();
  });
});

// --- Call Hierarchy ---

connection.languages.callHierarchy.onPrepare((params) => {
  if (!callHierarchyEnabled) return null;
  return withDocument(params.textDocument.uri, 'CallHierarchy', null, (text, doc, idx, um) => {
    return prepareCallHierarchy(doc, params.position, text, params.textDocument.uri, { idx, um });
  });
});

connection.languages.callHierarchy.onIncomingCalls((params) => {
  if (!callHierarchyEnabled) return [];
  return withDocument(params.item.uri, 'IncomingCalls', [], (text, doc, idx, um) => {
    return getIncomingCalls(doc, params.item, text, params.item.uri, { idx, um });
  });
});

connection.languages.callHierarchy.onOutgoingCalls((params) => {
  if (!callHierarchyEnabled) return [];
  return withDocument(params.item.uri, 'OutgoingCalls', [], (text, doc, idx, um) => {
    return getOutgoingCalls(doc, params.item, text, params.item.uri, { idx, um });
  });
});

// --- Selection Ranges ---

connection.onSelectionRanges((params) => {
  if (!selectionRangesEnabled) return null;
  return withDocument(params.textDocument.uri, 'SelectionRange', null, (text, doc, idx) => {
    return getSelectionRanges(doc, params.positions, text, { idx });
  });
});

// --- Document Formatting ---

connection.onDocumentFormatting((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  const text = doc.getText();
  try {
    const result = formatToEdits(text, formatterConfig);
    if (!result.changed) return [];
    return [TextEdit.replace(
      { start: { line: 0, character: 0 }, end: doc.positionAt(text.length) },
      result.newText,
    )];
  } catch (e) {
    connection.console.error(`DocumentFormatting error: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
});

connection.onDocumentRangeFormatting((params) => {
  // Range formatting: format the full document but only return edits within range.
  // This is the standard approach for formatters that need full-document context
  // (like alignment across cards).
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  const text = doc.getText();
  try {
    const result = formatToEdits(text, formatterConfig);
    if (!result.changed) return [];
    return [TextEdit.replace(
      { start: { line: 0, character: 0 }, end: doc.positionAt(text.length) },
      result.newText,
    )];
  } catch (e) {
    connection.console.error(`DocumentRangeFormatting error: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
});

// Wire up and start
documents.listen(connection);
connection.listen();
