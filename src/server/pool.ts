import { Disposable, Event, TextDocument, Uri, workspace, WorkspaceFolder, WorkspaceFoldersChangeEvent } from 'vscode';

import LintServer from './index';

export interface LintServerPoolDeps {
  /** The folders to serve. Injectable: the test host opens none. */
  folders?: () => readonly WorkspaceFolder[];
  /** Which folder a document belongs to. */
  folderFor?: (uri: Uri) => WorkspaceFolder | undefined;
  /** Folder add/remove notifications. */
  onDidChangeFolders?: Event<WorkspaceFoldersChangeEvent>;
}

/**
 * One Ruby lint server per workspace folder.
 *
 * A single server could not serve a multi-root workspace: it runs with one
 * working directory, so it picks up one `Gemfile`, and `Report.safe_config_file`
 * refuses a `.haml-lint.yml` outside it — every folder but the first was linted
 * with the first one's configuration, or not at all.
 *
 * Rails routes and asset completion stay on the first folder on purpose; only
 * linting is per folder.
 */
export class LintServerPool implements Disposable {
  private readonly servers = new Map<string, LintServer>();
  private readonly subscription: Disposable;
  private readonly folderFor: (uri: Uri) => WorkspaceFolder | undefined;

  constructor(
    private readonly create: (folder: WorkspaceFolder) => LintServer,
    deps: LintServerPoolDeps = {}
  ) {
    this.folderFor = deps.folderFor ?? ((uri) => workspace.getWorkspaceFolder(uri));

    for (const folder of deps.folders?.() ?? workspace.workspaceFolders ?? []) {
      this.add(folder);
    }

    const onDidChangeFolders = deps.onDidChangeFolders ?? workspace.onDidChangeWorkspaceFolders;

    this.subscription = onDidChangeFolders((event) => {
      event.removed.forEach((folder) => this.remove(folder));
      event.added.forEach((folder) => this.add(folder).start());
    });
  }

  /** The server for a document, or undefined when it lies outside the workspace. */
  public for(document: TextDocument): LintServer | undefined {
    const folder = this.folderFor(document.uri);

    return folder && this.servers.get(folder.uri.toString());
  }

  /** Any running server, for the questions that are not per folder (list_cops). */
  public any(): LintServer | undefined {
    return this.all().find((server) => server.rubyServerProcess) ?? this.all()[0];
  }

  public all(): LintServer[] {
    return Array.from(this.servers.values());
  }

  public allRunning(): boolean {
    return this.all().length > 0 && this.all().every((server) => server.rubyServerProcess);
  }

  /** Starts every server; one failing folder does not hold back the others. */
  public async startAll(): Promise<void> {
    await Promise.allSettled(this.all().map((server) => server.start()));
  }

  public async restartAll(): Promise<void> {
    await Promise.all(this.all().map((server) => server.restart()));
  }

  public dispose(): void {
    this.subscription.dispose();
    this.all().forEach((server) => server.stop());
    this.servers.clear();
  }

  private add(folder: WorkspaceFolder): LintServer {
    const key = folder.uri.toString();
    const existing = this.servers.get(key);

    if (existing) {
      return existing;
    }

    const server = this.create(folder);
    this.servers.set(key, server);

    return server;
  }

  private remove(folder: WorkspaceFolder): void {
    const key = folder.uri.toString();

    this.servers.get(key)?.stop();
    this.servers.delete(key);
  }
}
