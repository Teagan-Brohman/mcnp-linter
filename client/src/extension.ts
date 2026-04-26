import * as path from 'path';
import { ExtensionContext, workspace, window, languages, commands, Uri, Position, StatusBarAlignment, DiagnosticSeverity } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext): void {
  const serverModule = context.asAbsolutePath(
    path.join('server', 'out', 'server.js')
  );

  const config = workspace.getConfiguration('mcnpLinter');

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'mcnp' }],
    initializationOptions: {
      dataPath: config.get<string>('dataPath', ''),
      validateOnType: config.get<boolean>('validateOnType', true),
      debounceMs: config.get<number>('debounceMs', 500),
      materialDisplay: config.get<string>('materialDisplay', 'isotope'),
      resolveReadFiles: config.get<boolean>('resolveReadFiles', false),
      asciiSurfaceArt: config.get<boolean>('asciiSurfaceArt', false),
      warnLineLength: config.get<boolean>('warnLineLength', false),
      ignoreTemplatePlaceholders: config.get<boolean>('ignoreTemplatePlaceholders', true),
      suppressChecks: config.get<number[]>('suppressChecks', []),
      semanticTokensEnabled: config.get<boolean>('semanticTokens.enabled', true),
      callHierarchyEnabled: config.get<boolean>('callHierarchy.enabled', true),
      selectionRangesEnabled: config.get<boolean>('selectionRanges.enabled', true),
      inlayHints: {
        surfaceTypes: config.get<boolean>('inlayHints.surfaceTypes', true),
      },
      codeLens: {
        enabled: config.get<boolean>('codeLens.enabled', true),
      },
    },
    synchronize: {
      configurationSection: 'mcnpLinter',
    },
  };

  client = new LanguageClient(
    'mcnpLinter',
    'MCNP Linter',
    serverOptions,
    clientOptions
  );

  const statusBar = window.createStatusBarItem(StatusBarAlignment.Left, 100);
  statusBar.name = 'MCNP Linter';
  context.subscriptions.push(statusBar);

  function updateStatusBar(): void {
    const editor = window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'mcnp') {
      statusBar.hide();
      return;
    }

    const diagnostics = languages.getDiagnostics(editor.document.uri);
    const errors = diagnostics.filter(d => d.severity === DiagnosticSeverity.Error).length;
    const warnings = diagnostics.filter(d => d.severity === DiagnosticSeverity.Warning).length;

    if (errors === 0 && warnings === 0) {
      statusBar.text = '$(check) MCNP: OK';
      statusBar.backgroundColor = undefined;
    } else if (errors > 0) {
      statusBar.text = `$(error) MCNP: ${errors} error${errors !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''}`;
    } else {
      statusBar.text = `$(warning) MCNP: ${warnings} warning${warnings !== 1 ? 's' : ''}`;
    }

    statusBar.show();
  }

  // xsdir status bar item — sits left of the diagnostic-count item.
  const xsdirStatusBar = window.createStatusBarItem(StatusBarAlignment.Left, 99);
  xsdirStatusBar.name = 'MCNP xsdir';
  xsdirStatusBar.command = 'mcnp.openDataPathSetting';
  context.subscriptions.push(xsdirStatusBar);

  interface XsdirStatusPayload {
    state: 'unconfigured' | 'loaded' | 'not-found' | 'parse-error';
    configuredPath: string;
    resolvedFile?: string;
    zaidCount?: number;
    errorMessage?: string;
  }

  let lastXsdirStatus: XsdirStatusPayload = { state: 'unconfigured', configuredPath: '' };

  function updateXsdirStatus(): void {
    const editor = window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'mcnp') {
      xsdirStatusBar.hide();
      return;
    }
    const s = lastXsdirStatus;
    switch (s.state) {
      case 'loaded':
        xsdirStatusBar.text = `$(database) xsdir: ${s.zaidCount ?? '?'}`;
        xsdirStatusBar.tooltip = `Loaded ${s.zaidCount ?? 0} ZAIDs from ${s.resolvedFile ?? '(unknown)'}`;
        break;
      case 'unconfigured':
        xsdirStatusBar.text = '$(database) xsdir: not configured';
        xsdirStatusBar.tooltip = 'Set mcnpLinter.dataPath to enable xsdir-aware checks.';
        break;
      case 'not-found':
        xsdirStatusBar.text = '$(warning) xsdir: not found';
        xsdirStatusBar.tooltip = s.errorMessage ?? `No xsdir under ${s.configuredPath}`;
        break;
      case 'parse-error':
        xsdirStatusBar.text = '$(error) xsdir: parse error';
        xsdirStatusBar.tooltip = s.errorMessage ?? 'Failed to parse xsdir.';
        break;
    }
    xsdirStatusBar.show();
  }

  context.subscriptions.push(
    commands.registerCommand('mcnp.openDataPathSetting', () =>
      commands.executeCommand('workbench.action.openSettings', 'mcnpLinter.dataPath'),
    ),
  );

  context.subscriptions.push(
    commands.registerCommand('mcnp.silenceCheck', async (checkNumber: number) => {
      if (typeof checkNumber !== 'number' || !Number.isFinite(checkNumber)) return;
      const cfg = workspace.getConfiguration('mcnpLinter');
      const current = cfg.get<number[]>('suppressChecks', []);
      if (current.includes(checkNumber)) return;
      const next = [...current, checkNumber].sort((a, b) => a - b);
      await cfg.update('suppressChecks', next, true);
      window.showInformationMessage(
        `Silenced MCNP check #${checkNumber}. Edit mcnpLinter.suppressChecks to undo.`,
      );
    }),
  );

  context.subscriptions.push(
    languages.onDidChangeDiagnostics(() => updateStatusBar())
  );

  context.subscriptions.push(
    window.onDidChangeActiveTextEditor(() => {
      updateStatusBar();
      updateXsdirStatus();
    })
  );

  // Bridge command: CodeLens passes a string URI and plain {line,character} object.
  // editor.action.findReferences expects a vscode.Uri and vscode.Position instance.
  context.subscriptions.push(
    commands.registerCommand('mcnp.findReferences', (uriString: string, position: { line: number; character: number }) => {
      commands.executeCommand('editor.action.findReferences', Uri.parse(uriString), new Position(position.line, position.character));
    })
  );

  // Send cursor position to server for cursor-aware CodeLens
  context.subscriptions.push(
    window.onDidChangeTextEditorSelection((e) => {
      if (e.textEditor.document.languageId === 'mcnp' && client.isRunning()) {
        client.sendNotification('mcnp/cursorPosition', {
          uri: e.textEditor.document.uri.toString(),
          line: e.selections[0].active.line,
        });
      }
    })
  );

  context.subscriptions.push(client);
  client.start().then(() => {
    client.onNotification('mcnp/xsdirStatus', (payload: XsdirStatusPayload) => {
      lastXsdirStatus = payload;
      updateXsdirStatus();
    });
    updateStatusBar();
    updateXsdirStatus();
  });
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
