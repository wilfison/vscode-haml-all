import {
  workspace,
  languages,
  CodeActionKind,
  TextDocument,
  ExtensionContext,
  Uri,
} from 'vscode';

import Linter from './linter';
import FixActionsProvider from './FixActionsProvider';
import { refreshRoutes } from './rails/utils';
import Routes from './rails/routes';
import { isARailsProject } from './Helpers';

class EventSubscriber {
  public routes: Routes;
  public isARailsProject: boolean = false;
  public linter: Linter;

  private context: ExtensionContext;
  private rootPath: Uri;

  constructor(context: ExtensionContext) {
    this.context = context;
    this.rootPath = workspace.workspaceFolders![0].uri;

    this.isARailsProject = isARailsProject();

    this.linter = new Linter();
    this.routes = new Routes(this.rootPath.fsPath);
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

  private subscribeToEvents() {
    const updateDiagnostics = (document: TextDocument) => this.linter.run(document);

    this.context.subscriptions.push(this.linter);

    this.context.subscriptions.push(
      workspace.onDidSaveTextDocument(async (document: TextDocument) => {
        updateDiagnostics(document);
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

    this.updateAllDiagnostics();
  }

  private onUpdateLintConfig() {
    this.updateAllDiagnostics();
    this.linter.loadConfigs();
  }

  private subscribeHamlWatchers() {
    this.subscribeFileWatcher('**/.haml-lint.yml', this.onUpdateLintConfig);
    this.subscribeFileWatcher('**/.rubocop.yml', this.onUpdateLintConfig);
  }

  private subscribeRailsWatchers() {
    const routeFiles = [
      '**/config/routes.rb',
      '**/config/routes/**/*.rb',
    ];

    routeFiles.forEach(pattern => this.subscribeFileWatcher(pattern, () => refreshRoutes(this.routes)));
  }

  private subscribeFileWatcher(pattern: string, callback: (e: Uri) => void): void {
    const watcher = workspace.createFileSystemWatcher(pattern);

    watcher.onDidChange(callback);
    watcher.onDidCreate(callback);

    this.context.subscriptions.push(watcher);
  }
}

export default EventSubscriber;
