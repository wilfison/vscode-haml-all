import { workspace, ExtensionContext, Uri, OutputChannel } from 'vscode';

import { loadWithProgress } from './rails/utils';
import Routes from './rails/routes';

/**
 * EventSubscriber - Manages file watchers and events for Rails-specific features.
 * Note: Linting and formatting are now provided by the HAML LSP server.
 */
class EventSubscriber {
  public routes: Routes;
  public isARailsProject: boolean = false;

  private context: ExtensionContext;
  private outputChanel: OutputChannel;
  private rootPath: Uri;

  constructor(context: ExtensionContext, outputChanel: OutputChannel, isARailsProject: boolean) {
    this.context = context;
    this.outputChanel = outputChanel;
    this.rootPath = workspace.workspaceFolders![0].uri;

    this.isARailsProject = isARailsProject;

    this.routes = new Routes(this.rootPath.fsPath, this.outputChanel, isARailsProject);
  }

  public subscribe(otherEvents: any[] = []): void {
    this.subscribeRails();

    otherEvents.forEach((event) => this.context.subscriptions.push(event));
  }

  public subscribeRails() {
    if (this.isARailsProject) {
      this.routes.load();
      this.subscribeRailsWatchers();
    }
  }

  /**
   * Note: Linting configuration is now managed by the HAML LSP server.
   * The LSP server automatically watches for .haml-lint.yml changes.
   */

  private subscribeRailsWatchers() {
    const watchRouteFiles = ['**/config/routes.rb', '**/config/routes/**/*.rb'];

    watchRouteFiles.forEach((pattern) =>
      this.subscribeFileWatcher(pattern, () => {
        loadWithProgress('Loading rails routes', this.routes.load);
      })
    );
  }

  private subscribeFileWatcher(pattern: string, callback: (e: Uri) => void): void {
    const watcher = workspace.createFileSystemWatcher(pattern);

    watcher.onDidChange(callback);
    watcher.onDidCreate(callback);

    this.context.subscriptions.push(watcher);
  }
}

export default EventSubscriber;
