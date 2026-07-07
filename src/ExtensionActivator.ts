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
import { openFile } from './utils/file';
import * as helpers from './Helpers';

/**
 * Manages the activation and registration of all extension features.
 * Handles initialization of providers, commands, and event subscribers for both HAML and Rails-specific functionality.
 */
export class ExtensionActivator {
  private readonly HAML_SELECTOR = { language: 'haml', scheme: 'file' };
  private readonly RUBY_SELECTOR = { language: 'ruby', scheme: 'file' };
  private isARailsProject: boolean = false;

  /**
   * Creates a new ExtensionActivator instance.
   * @param context - The VS Code extension context
   * @param outputChannel - Output channel for logging
   * @param lintServer - The Ruby-based linting server instance
   */
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly lintServer: LintServer
  ) {
    this.isARailsProject = helpers.isARailsProject(this.outputChannel);
  }

  /**
   * Activates the extension by registering all providers, commands, and event subscribers.
   * This is called when the extension is first activated.
   */
  public async activate(): Promise<void> {
    const eventSubscriber = new EventSubscriber(this.context, this.outputChannel, this.lintServer, this.isARailsProject);

    eventSubscriber.subscribe();

    this.registerCommands();
    this.registerHamlProviders(eventSubscriber);
    this.registerRailsProviders(eventSubscriber);
  }

  private registerRailsProviders(eventSubscriber: EventSubscriber): void {
    if (!eventSubscriber.isARailsProject) {
      return;
    }

    this.context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        [this.RUBY_SELECTOR, this.HAML_SELECTOR],
        new RoutesCompletionProvider(eventSubscriber.routes)
      )
    );

    this.context.subscriptions.push(
      vscode.languages.registerDefinitionProvider(this.HAML_SELECTOR, new RoutesDefinitionProvider(eventSubscriber.routes))
    );

    this.context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(this.HAML_SELECTOR, new AssetsCompletionProvider(), '"', "'")
    );

    if (this.isARailsProject) {
      this.context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(this.HAML_SELECTOR, new DataAttributeCompletionProvider(), '-', '_')
      );

      this.context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(this.HAML_SELECTOR, new ImagePreviewCodeLensProvider())
      );
    }
  }

  private registerHamlProviders(eventSubscriber: EventSubscriber): void {
    this.context.subscriptions.push(
      vscode.languages.registerDocumentFormattingEditProvider(
        this.HAML_SELECTOR,
        new FormattingEditProvider(eventSubscriber.linter, this.outputChannel, this.lintServer)
      )
    );

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
    // No resources to dispose beyond context subscriptions.
  }
}
