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
} from 'vscode';

import Linter from './linter';
import FixActionsProvider from './providers/FixActionsProvider';
import { loadWithProgress } from './rails/utils';
import Routes from './rails/routes';
import { isARailsProject } from './Helpers';
import LintServer from './server';

class EventSubscriber {
  public routes: Routes;
  public isARailsProject: boolean = false;
  public linter: Linter;

  private context: ExtensionContext;
  private outputChanel: OutputChannel;
  private rootPath: Uri;

  constructor(context: ExtensionContext, outputChanel: OutputChannel, lintServer: LintServer) {
    this.context = context;
    this.outputChanel = outputChanel;
    this.rootPath = workspace.workspaceFolders![0].uri;

    this.isARailsProject = isARailsProject();

    this.linter = new Linter(this.outputChanel, lintServer);
    this.routes = new Routes(this.rootPath.fsPath, this.outputChanel);
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
    }
  }

  public unsubscribe() {
    this.context.subscriptions.forEach(subscription => subscription.dispose());
  }

  public updateAllDiagnostics(_event: any = null) {
    this.linter.clearAll();

    workspace.textDocuments.forEach(document => this.linter.run(document));
  }

  private async subscribeToEvents() {
    const updateDiagnostics = (document: TextDocument) => this.linter.run(document);

    this.context.subscriptions.push(this.linter);

    this.context.subscriptions.push(
      workspace.onDidSaveTextDocument(async (document: TextDocument) => {
        updateDiagnostics(document);
      })
    );

    this.context.subscriptions.push(
      workspace.onDidChangeTextDocument(async (event) => {
        if (event.contentChanges.length > 0 && event.document === window.activeTextEditor?.document) {
          updateDiagnostics(event.document);
        }
      })
    );

    this.context.subscriptions.push(
      workspace.onDidOpenTextDocument(updateDiagnostics)
    );

    this.context.subscriptions.push(
      workspace.onDidCloseTextDocument(document => this.linter.clear(document))
    );

    this.context.subscriptions.push(
      languages.registerCodeActionsProvider(
        'haml',
        new FixActionsProvider(),
        {
          providedCodeActionKinds: [CodeActionKind.QuickFix]
        }
      )
    );

    window.withProgress(
      {
        location: ProgressLocation.Window,
        title: 'Initializing HAML Lint',
      },
      async () => {
        await this.linter.startServer();
        await this.onUpdateLintConfig();
      },
    );
  }

  private async onUpdateLintConfig() {
    this.updateAllDiagnostics();
    this.linter.loadConfigs();
  }

  private subscribeHamlWatchers() {
    const watchFiles = [
      '**/.haml-lint.yml',
    ];

    watchFiles.forEach(pattern => this.subscribeFileWatcher(pattern, () => {
      loadWithProgress('Loading lint configs', this.onUpdateLintConfig.bind(this));
    }));
  }

  private subscribeRailsWatchers() {
    const watchFiles = [
      '**/config/routes.rb',
      '**/config/routes/**/*.rb',
    ];

    watchFiles.forEach(pattern => this.subscribeFileWatcher(pattern, () => {
      loadWithProgress('Loading rails routes', this.routes.load);
    }));
  }

  private subscribeFileWatcher(pattern: string, callback: (e: Uri) => void): void {
    const watcher = workspace.createFileSystemWatcher(pattern);

    watcher.onDidChange(callback);
    watcher.onDidCreate(callback);

    this.context.subscriptions.push(watcher);
  }
}

export default EventSubscriber;
