import * as vscode from 'vscode';

import EventSubscriber from './EventSubscriber';
import ViewCompletionProvider from './providers/ViewCompletionProvider';
import ViewFileDefinitionProvider from './providers/ViewFileDefinitionProvider';
import RoutesCompletionProvider from './providers/RoutesCompletionProvider';
import RoutesDefinitionProvider from './providers/RoutesDefinitionProvider';
import PartialSignatureHelpProvider from './providers/PartialSignatureHelpProvider';
import CodeLensProvider from './providers/CodeLensProvider';
import FormattingEditProvider, { FIX_ALL_KIND } from './providers/FormattingEditProvider';
import { ViewCodeActionProvider, createPartialFromSelection, wrapContentInBlock } from './providers/ViewCodeActionProvider';
import DataAttributeCompletionProvider from './providers/DataAttributeCompletionProvider';
import AssetsCompletionProvider from './providers/AssetsCompletionProvider';
import AssetsDefinitionProvider from './providers/AssetsDefinitionProvider';
import ImagePreviewCodeLensProvider from './providers/ImagePreviewCodeLensProvider';

import LintServer from './server';
import { LintServerPool } from './server/pool';
import { LintStatusBar } from './StatusBar';

import { html2Haml } from './html2Haml';
import { openFile, getWorkspaceRoot } from './utils/file';
import * as helpers from './Helpers';

/**
 * Registers every provider, command and event subscriber. Features that only read files
 * register unconditionally; anything that runs repository code waits for workspace trust.
 */
export class ExtensionActivator {
  private readonly HAML_SELECTOR = { language: 'haml', scheme: 'file' };
  private readonly RUBY_SELECTOR = { language: 'ruby', scheme: 'file' };
  private isARailsProject: boolean = false;
  private lintServers: LintServerPool | undefined;
  private statusBar: LintStatusBar | undefined;
  private trustedActivated = false;
  private eventSubscriber: EventSubscriber | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.OutputChannel
  ) {
    // A plain existsSync on bin/rails: it spawns nothing, so it is safe before trust.
    this.isARailsProject = helpers.isARailsProject(this.outputChannel);
  }

  public async activate(): Promise<void> {
    this.registerCommands();
    this.registerHamlProviders();
    this.registerRailsProviders();

    if (vscode.workspace.isTrusted) {
      this.activateTrusted();
      return;
    }

    this.outputChannel.appendLine('Workspace is not trusted: Ruby tooling disabled.');

    this.context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => this.activateTrusted()));
  }

  /**
   * Registers everything that runs the project's Ruby tooling, from {@link activate}
   * or from the trust grant. Guarded so it only ever runs once.
   */
  private activateTrusted(): void {
    if (this.trustedActivated) {
      return;
    }
    this.trustedActivated = true;

    // Read on every (re)start, so changing either setting only costs a restart.
    const serverOptions = () => ({
      useBundler: vscode.workspace.getConfiguration('hamlAll').get<boolean>('useBundler', false),
      rubyCommand: helpers.rubyCommand(),
    });

    // Created here rather than in activate(): with no trust there is no server,
    // so there is no state to report.
    this.statusBar = new LintStatusBar();
    this.context.subscriptions.push(this.statusBar);

    // One server per workspace folder: each has its own Gemfile, working
    // directory and .haml-lint.yml. Routes and assets stay on the first folder.
    this.lintServers = new LintServerPool((folder) => {
      const server = new LintServer(folder.uri.fsPath, serverOptions, this.outputChannel);
      server.setRestartHandlers(this.restartHandlers(folder.name));

      return server;
    });
    this.context.subscriptions.push(this.lintServers);

    // Probe for haml-lint in the background so a slow Ruby boot never delays
    // activation; surface the error only if the gem is genuinely missing.
    helpers.hamlLintPresent().then((present) => {
      if (!present) {
        this.statusBar?.warning('haml-lint not found. Install the gem, or set hamlAll.useBundler.');
        vscode.window.showErrorMessage('haml-lint not found. Please install haml-lint gem to use this extension.');
      }
    });

    const eventSubscriber = new EventSubscriber(this.context, this.outputChannel, this.lintServers, this.isARailsProject);
    this.eventSubscriber = eventSubscriber;

    eventSubscriber.subscribe();

    const formattingProvider = new FormattingEditProvider(eventSubscriber.linter, this.outputChannel, this.lintServers, () =>
      eventSubscriber.cancelPendingLint()
    );

    this.context.subscriptions.push(
      vscode.languages.registerDocumentFormattingEditProvider(this.HAML_SELECTOR, formattingProvider),
      // `editor.codeActionsOnSave: { "source.fixAll.hamlLint": "explicit" }`
      vscode.languages.registerCodeActionsProvider(this.HAML_SELECTOR, formattingProvider, {
        providedCodeActionKinds: [FIX_ALL_KIND],
      })
    );

    // Both settings only take effect when the server process is spawned, so a change
    // is worth a restart; otherwise it would need a window reload.
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        const changed = ['hamlAll.useBundler', 'hamlAll.rubyCommand'].find((setting) => event.affectsConfiguration(setting));

        if (changed) {
          this.outputChannel.appendLine(`Haml All: ${changed} changed, restarting the lint server`);
          this.restartLintServer();
        }
      })
    );

    if (this.isARailsProject) {
      this.context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
          [this.RUBY_SELECTOR, this.HAML_SELECTOR],
          new RoutesCompletionProvider(eventSubscriber.routes)
        ),

        vscode.languages.registerDefinitionProvider(this.HAML_SELECTOR, new RoutesDefinitionProvider(eventSubscriber.routes))
      );
    }
  }

  private registerRailsProviders(): void {
    if (!this.isARailsProject) {
      return;
    }

    // Asset completion lists files from Rails' asset directories, so it is the
    // only one of the three that a non-Rails project has no use for.
    this.context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(this.HAML_SELECTOR, new AssetsCompletionProvider(), '"', "'")
    );
  }

  private registerHamlProviders(): void {
    this.context.subscriptions.push(
      vscode.languages.registerDefinitionProvider(this.HAML_SELECTOR, new ViewFileDefinitionProvider())
    );

    this.context.subscriptions.push(
      vscode.languages.registerDefinitionProvider(this.HAML_SELECTOR, new AssetsDefinitionProvider())
    );

    this.context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(this.HAML_SELECTOR, new ViewCompletionProvider(), '"', "'")
    );

    this.context.subscriptions.push(
      vscode.languages.registerSignatureHelpProvider(this.HAML_SELECTOR, new PartialSignatureHelpProvider(), '(', ',')
    );

    this.context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(this.HAML_SELECTOR, new ViewCodeActionProvider(), {
        providedCodeActionKinds: [vscode.CodeActionKind.RefactorExtract],
      })
    );

    this.context.subscriptions.push(vscode.languages.registerCodeLensProvider(this.HAML_SELECTOR, new CodeLensProvider()));

    // Neither of these reads anything Rails-specific: data attributes are HTML,
    // Turbo and Stimulus, and the image preview resolves paths on disk.
    this.context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(this.HAML_SELECTOR, new DataAttributeCompletionProvider(), '-', '_'),

      vscode.languages.registerCodeLensProvider(this.HAML_SELECTOR, new ImagePreviewCodeLensProvider())
    );
  }

  private registerCommands(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand('hamlAll.createPartialFromSelection', createPartialFromSelection),

      vscode.commands.registerCommand('hamlAll.wrapInConditional', () => {
        wrapContentInBlock('- if condition');
      }),

      vscode.commands.registerCommand('hamlAll.wrapInBlock', () => {
        wrapContentInBlock('- (1..5).each do |item|');
      }),

      vscode.commands.registerCommand('hamlAll.html2Haml', () => html2Haml(this.outputChannel)),

      vscode.commands.registerCommand('hamlAll.openFile', (path, lineNumber) => {
        this.outputChannel.appendLine(`Opening file: ${path}:${lineNumber}`);
        openFile(path, lineNumber);
      }),

      vscode.commands.registerCommand('hamlAll.previewImage', (imagePath: string, imageName: string) => {
        ImagePreviewCodeLensProvider.showImagePreview(imagePath, imageName);
      }),

      vscode.commands.registerCommand('hamlAll.restartLintServer', () => this.restartLintServer()),

      vscode.commands.registerCommand('hamlAll.showOutput', () => this.outputChannel.show())
    );
  }

  /**
   * What every server reports back. A restarted server needs its diagnostics and cop
   * list rebuilt; the status bar reads "running" only once every folder's server is up.
   */
  private restartHandlers(folderName: string) {
    const problem = (message: string) => this.statusBar?.warning(`${message} (folder "${folderName}")`);

    return {
      onRestarted: async () => {
        await this.eventSubscriber?.linter.loadConfigs();
        this.eventSubscriber?.updateAllDiagnostics();
      },
      onGaveUp: () => {
        problem('haml-lint server stopped and could not be restarted. Run "HAML: Restart lint server"');
        this.reportLintServerGaveUp();
      },
      onStarted: () => {
        if (this.lintServers?.allRunning()) {
          this.statusBar?.ok();
        }
      },
      onFailed: () => problem('haml-lint server failed to start'),
      onRestarting: (attempt: number, attempts: number) =>
        problem(`haml-lint server died, restarting (attempt ${attempt} of ${attempts})`),
    };
  }

  /**
   * Restarts the Ruby lint server on demand. Also the only way to reset the
   * automatic-restart counter once it has been exhausted.
   */
  private async restartLintServer(): Promise<void> {
    // Same policy as html2Haml: running the project's Ruby tooling needs trust.
    if (!vscode.workspace.isTrusted) {
      vscode.window.showWarningMessage('Trust the workspace to run the HAML lint server.');
      return;
    }

    if (!this.lintServers) {
      return;
    }

    this.outputChannel.appendLine('Restarting Haml Lint server (requested by the user)...');
    this.statusBar?.starting();

    try {
      await this.lintServers.restartAll();
      this.outputChannel.appendLine('Haml Lint server restarted.');
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.showWithOutput(`Failed to restart the HAML lint server. ${reason}`);
    }
  }

  private reportLintServerGaveUp(): void {
    this.showWithOutput('The HAML lint server stopped and could not be restarted. Run "HAML: Restart lint server" to try again.');
  }

  private showWithOutput(message: string): void {
    vscode.window.showErrorMessage(message, 'Show Output').then((selection) => {
      if (selection === 'Show Output') {
        this.outputChannel.show();
      }
    });
  }

  /** Disposes of extension resources, on deactivation. */
  public dispose(): void {
    this.lintServers?.dispose();
  }
}
