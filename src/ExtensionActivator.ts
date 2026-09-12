import * as vscode from 'vscode';

import EventSubscriber from './EventSubscriber';
import ViewCompletionProvider from './providers/ViewCompletionProvider';
import ViewFileDefinitionProvider from './providers/ViewFileDefinitionProvider';
import RoutesCompletionProvider from './providers/RoutesCompletionProvider';
import RoutesDefinitionProvider from './providers/RoutesDefinitionProvider';
import PartialSignatureHelpProvider from './providers/PartialSignatureHelpProvider';
import CodeLensProvider from './providers/CodeLensProvider';
import FormattingEditProvider from './providers/FormattingEditProvider';
import { ViewCodeActionProvider, createPartialFromSelection, wrapContentInBlock } from './providers/ViewCodeActionProvider';
import DataAttributeCompletionProvider from './providers/DataAttributeCompletionProvider';
import AssetsCompletionProvider from './providers/AssetsCompletionProvider';
import AssetsDefinitionProvider from './providers/AssetsDefinitionProvider';
import ImagePreviewCodeLensProvider from './providers/ImagePreviewCodeLensProvider';

import LintServer from './server';

import { html2Haml } from './html2Haml';
import { openFile, getWorkspaceRoot } from './utils/file';
import * as helpers from './Helpers';

/**
 * Manages the activation and registration of all extension features.
 * Handles initialization of providers, commands, and event subscribers for both HAML and Rails-specific functionality.
 *
 * Activation is split in two: features that only read files and buffers are
 * registered unconditionally, while everything that runs the project's Ruby
 * tooling waits for workspace trust. Linting, formatting and `bin/rails routes`
 * all execute code that lives in the repository (a `require:` in
 * .haml-lint.yml, the Gemfile, bin/rails itself), so running them in an
 * untrusted workspace would turn opening a .haml file into arbitrary code
 * execution.
 */
export class ExtensionActivator {
  private readonly HAML_SELECTOR = { language: 'haml', scheme: 'file' };
  private readonly RUBY_SELECTOR = { language: 'ruby', scheme: 'file' };
  private isARailsProject: boolean = false;
  private lintServer: LintServer | undefined;
  private trustedActivated = false;

  /**
   * Creates a new ExtensionActivator instance.
   * @param context - The VS Code extension context
   * @param outputChannel - Output channel for logging
   */
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.OutputChannel
  ) {
    // Detection is a plain existsSync on bin/rails; it spawns nothing, so it is
    // safe to run before the workspace is trusted.
    this.isARailsProject = helpers.isARailsProject(this.outputChannel);
  }

  /**
   * Activates the extension by registering all providers, commands, and event subscribers.
   * This is called when the extension is first activated.
   */
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
   * Registers everything that runs the project's Ruby tooling. Called either
   * straight from {@link activate} or later, once the user grants trust —
   * guarded so it only ever runs once.
   */
  private activateTrusted(): void {
    if (this.trustedActivated) {
      return;
    }
    this.trustedActivated = true;

    const config = vscode.workspace.getConfiguration('hamlAll');
    this.lintServer = new LintServer(getWorkspaceRoot(), config.useBundler, this.outputChannel, helpers.rubyCommand());

    // Probe for haml-lint in the background so a slow Ruby boot never delays
    // activation; surface the error only if the gem is genuinely missing.
    helpers.hamlLintPresent().then((present) => {
      if (!present) {
        vscode.window.showErrorMessage('haml-lint not found. Please install haml-lint gem to use this extension.');
      }
    });

    const eventSubscriber = new EventSubscriber(this.context, this.outputChannel, this.lintServer, this.isARailsProject);

    eventSubscriber.subscribe();

    this.context.subscriptions.push(
      vscode.languages.registerDocumentFormattingEditProvider(
        this.HAML_SELECTOR,
        new FormattingEditProvider(eventSubscriber.linter, this.outputChannel, this.lintServer)
      )
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

    this.context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(this.HAML_SELECTOR, new AssetsCompletionProvider(), '"', "'"),

      vscode.languages.registerCompletionItemProvider(this.HAML_SELECTOR, new DataAttributeCompletionProvider(), '-', '_'),

      vscode.languages.registerCodeLensProvider(this.HAML_SELECTOR, new ImagePreviewCodeLensProvider())
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

      vscode.commands.registerCommand('hamlAll.html2Haml', html2Haml),

      vscode.commands.registerCommand('hamlAll.openFile', (path, lineNumber) => {
        this.outputChannel.appendLine(`Opening file: ${path}:${lineNumber}`);
        openFile(path, lineNumber);
      }),

      vscode.commands.registerCommand('hamlAll.previewImage', (imagePath: string, imageName: string) => {
        ImagePreviewCodeLensProvider.showImagePreview(imagePath, imageName);
      })
    );
  }

  /**
   * Disposes of extension resources.
   * Called when the extension is deactivated.
   */
  public dispose(): void {
    this.lintServer?.stop();
  }
}
