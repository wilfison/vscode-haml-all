import {
  workspace,
  languages,
  CodeActionKind,
  TextDocument,
  ExtensionContext,
  Uri,
  OutputChannel,
  window,
  ProgressLocation,
  FileSystemWatcher,
} from 'vscode';

import Linter from './linter';
import FixActionsProvider from './providers/FixActionsProvider';
import { loadWithProgress } from './rails/utils';
import { invalidateAssetIndex } from './rails/assetIndex';
import Routes from './rails/routes';
import LintServer from './server';

class EventSubscriber {
  public routes: Routes;
  public isARailsProject: boolean = false;
  public linter: Linter;

  private context: ExtensionContext;
  private outputChanel: OutputChannel;
  private rootPath: Uri;

  private changeDebounce?: NodeJS.Timeout;
  private readonly CHANGE_DEBOUNCE_MS = 300;

  constructor(context: ExtensionContext, outputChanel: OutputChannel, lintServer: LintServer, isARailsProject: boolean) {
    this.context = context;
    this.outputChanel = outputChanel;
    const workspaceFolder = workspace.workspaceFolders?.[0];
    this.rootPath = workspaceFolder ? workspaceFolder.uri : Uri.file('');

    this.isARailsProject = isARailsProject;

    this.linter = new Linter(this.outputChanel, lintServer);
    this.routes = new Routes(this.rootPath.fsPath, this.outputChanel, isARailsProject);
  }

  public subscribe(): void {
    this.subscribeHaml();
    this.subscribeRails();
  }

  public subscribeHaml() {
    this.subscribeToEvents();
    this.subscribeHamlWatchers();
  }

  public subscribeRails() {
    if (this.isARailsProject) {
      this.routes.load();
      this.subscribeRailsWatchers();
      this.subscribeAssetWatchers();
    }
  }

  public unsubscribe() {
    this.context.subscriptions.forEach((subscription) => subscription.dispose());
  }

  public updateAllDiagnostics(_event: any = null) {
    this.linter.clearAll();

    workspace.textDocuments.forEach((document) => this.linter.run(document));
  }

  private async subscribeToEvents() {
    const updateDiagnostics = (document: TextDocument) => this.linter.run(document);

    this.context.subscriptions.push(this.linter);

    this.context.subscriptions.push(
      workspace.onDidSaveTextDocument(async (document: TextDocument) => {
        // Saving lints immediately, so drop any pending change-debounced lint to
        // avoid running the same document twice back to back.
        this.clearChangeDebounce();
        updateDiagnostics(document);
      })
    );

    this.context.subscriptions.push(
      workspace.onDidChangeTextDocument(async (event) => {
        if (event.contentChanges.length > 0 && event.document === window.activeTextEditor?.document) {
          this.clearChangeDebounce();
          this.changeDebounce = setTimeout(() => updateDiagnostics(event.document), this.CHANGE_DEBOUNCE_MS);
        }
      })
    );

    this.context.subscriptions.push(
      workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('hamlAll.lintEnabled')) {
          this.updateAllDiagnostics();
        }
      })
    );

    this.context.subscriptions.push({
      dispose: () => this.clearChangeDebounce(),
    });

    this.context.subscriptions.push(workspace.onDidOpenTextDocument(updateDiagnostics));
    this.context.subscriptions.push(workspace.onDidCloseTextDocument((document) => this.linter.clear(document)));

    this.context.subscriptions.push(
      languages.registerCodeActionsProvider('haml', new FixActionsProvider(), {
        providedCodeActionKinds: [CodeActionKind.QuickFix],
      })
    );

    window.withProgress(
      {
        location: ProgressLocation.Window,
        title: 'Initializing HAML Lint',
      },
      async () => {
        await this.linter.startServer();
        await this.onUpdateLintConfig();
      }
    );
  }

  private clearChangeDebounce() {
    if (this.changeDebounce) {
      clearTimeout(this.changeDebounce);
      this.changeDebounce = undefined;
    }
  }

  private async onUpdateLintConfig() {
    this.updateAllDiagnostics();
    this.linter.loadConfigs();
  }

  private subscribeHamlWatchers() {
    const watchFiles = ['**/.haml-lint.yml'];

    watchFiles.forEach((pattern) =>
      this.subscribeFileWatcher(pattern, () => {
        loadWithProgress('Loading lint configs', this.onUpdateLintConfig.bind(this));
      })
    );
  }

  private subscribeRailsWatchers() {
    const watchRouteFiles = ['**/config/routes.rb', '**/config/routes/**/*.rb'];

    watchRouteFiles.forEach((pattern) =>
      this.subscribeFileWatcher(pattern, () => {
        loadWithProgress('Loading rails routes', () => this.routes.load());
      })
    );
  }

  // Invalidate the cached asset listing when files appear or disappear under an
  // asset directory. A content edit is ignored on purpose: the index only holds
  // paths, so only create/delete changes the file set.
  private subscribeAssetWatchers() {
    const assetPatterns = [
      '**/app/assets/**',
      '**/app/javascript/**',
      '**/app/frontend/**',
      '**/public/**',
      '**/vendor/assets/**',
    ];

    assetPatterns.forEach((pattern) => {
      const watcher = workspace.createFileSystemWatcher(pattern, false, true, false);

      watcher.onDidCreate(() => invalidateAssetIndex());
      watcher.onDidDelete(() => invalidateAssetIndex());

      this.context.subscriptions.push(watcher);
    });
  }

  private subscribeFileWatcher(pattern: string, callback: (e: Uri) => void): void {
    const watcher = workspace.createFileSystemWatcher(pattern);

    watcher.onDidChange(callback);
    watcher.onDidCreate(callback);

    this.context.subscriptions.push(watcher);
  }
}

export default EventSubscriber;
