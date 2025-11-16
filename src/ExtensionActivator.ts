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
import ImagePreviewCodeLensProvider from './providers/ImagePreviewCodeLensProvider';
import I18nProvider from './providers/i18n';

import LivePreviewPanel from './LivePreviewPanel';
import LintServer from './server';

import { html2Haml } from './html2Haml';
import { openFile } from './utils/file';
import * as helpers from './Helpers';

export class ExtensionActivator {
  private readonly HAML_SELECTOR = { language: 'haml', scheme: 'file' };
  private readonly RUBY_SELECTOR = { language: 'ruby', scheme: 'file' };
  private isARailsProject: boolean = false;
  private i18nProvider: I18nProvider;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly lintServer: LintServer
  ) {
    this.isARailsProject = helpers.isARailsProject(this.outputChannel);
    this.i18nProvider = new I18nProvider(this.outputChannel);
  }

  public async activate(): Promise<void> {
    const eventSubscriber = new EventSubscriber(this.context, this.outputChannel, this.lintServer, this.isARailsProject);

    eventSubscriber.subscribe([this.i18nProvider.subscribeFileWatcher()]);

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

      this.context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
          this.HAML_SELECTOR,
          this.i18nProvider.i18nCompletionProvider,
          '.',
          '_',
          "'",
          '"'
        )
      );

      this.context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(this.HAML_SELECTOR, this.i18nProvider.i18nDefinitionProvider)
      );

      // Only register validation listeners if I18n validation is enabled
      if (this.i18nProvider.isI18nValidationEnabled()) {
        vscode.workspace.onDidChangeTextDocument((event) => {
          if (event.document.languageId === 'haml') {
            this.i18nProvider.i18nDiagnosticsProvider.validateDocument(event.document);
          }
        });

        vscode.workspace.onDidOpenTextDocument((document) => {
          if (document.languageId === 'haml') {
            this.i18nProvider.i18nDiagnosticsProvider.validateDocument(document);
          }
        });

        // Listen for configuration changes to enable/disable validation dynamically
        vscode.workspace.onDidChangeConfiguration((event) => {
          if (event.affectsConfiguration('hamlAll.i18nValidation.enabled')) {
            // If validation was disabled, clear all diagnostics
            if (!this.i18nProvider.isI18nValidationEnabled()) {
              this.i18nProvider.i18nDiagnosticsProvider.diagnosticCollection.clear();
            } else {
              // If validation was enabled, validate all open HAML documents
              vscode.workspace.textDocuments.forEach((document) => {
                if (document.languageId === 'haml') {
                  this.i18nProvider.i18nDiagnosticsProvider.validateDocument(document);
                }
              });
            }
          }

          // If default locale configuration changed, reload locales data
          if (event.affectsConfiguration('hamlAll.i18nValidation.defaultLocale')) {
            this.i18nProvider.setupData();
          }
        });
      }
    }

    eventSubscriber.subscribeRails();
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

      vscode.commands.registerCommand('hamlAll.livePreview', () => {
        LivePreviewPanel.createOrShow(this.context.extensionUri, this.lintServer);
      }),

      vscode.commands.registerCommand('hamlAll.openFile', (path, lineNumber) => {
        this.outputChannel.appendLine(`Opening file: ${path}:${lineNumber}`);
        openFile(path, lineNumber);
      }),

      vscode.commands.registerCommand('hamlAll.previewImage', (imagePath: string, imageName: string) => {
        ImagePreviewCodeLensProvider.showImagePreview(imagePath, imageName);
      })
    );
  }

  public dispose(): void {
    this.i18nProvider.dispose();
  }
}
