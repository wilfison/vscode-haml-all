import * as vscode from 'vscode';

import EventSubscriber from './EventSubscriber';
import ViewCompletionProvider from './providers/ViewCompletionProvider';
import ViewFileDefinitionProvider from './providers/ViewFileDefinitionProvider';
import RoutesCompletionProvider from './providers/RoutesCompletionProvider';
import RoutesDefinitionProvider from './providers/RoutesDefinitionProvider';
import PartialSignatureHelpProvider from './providers/PartialSignatureHelpProvider';
import CodeLensProvider from './providers/CodeLensProvider';
import FormattingEditProvider from './providers/FormattingEditProvider';
import { ViewCodeActionProvider, createPartialFromSelection } from './providers/ViewCodeActionProvider';

import LivePreviewPanel from './LivePreviewPanel';
import LintServer from './linter/server';

import { html2Haml } from './html2Haml';
import { openFile } from './ultils/file';

export class ExtensionActivator {
  private readonly HAML_SELECTOR = { language: 'haml', scheme: 'file' };
  private readonly RUBY_SELECTOR = { language: 'ruby', scheme: 'file' };

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly lintServer: LintServer
  ) { }

  public async activate(): Promise<void> {
    const eventSubscriber = new EventSubscriber(this.context, this.outputChannel, this.lintServer);
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
        new RoutesCompletionProvider(eventSubscriber.routes),
      )
    );

    this.context.subscriptions.push(
      vscode.languages.registerDefinitionProvider(
        this.HAML_SELECTOR,
        new RoutesDefinitionProvider(eventSubscriber.routes)
      )
    );

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
      vscode.languages.registerCompletionItemProvider(
        this.HAML_SELECTOR,
        new ViewCompletionProvider(),
        '"',
        '\''
      )
    );

    this.context.subscriptions.push(
      vscode.languages.registerSignatureHelpProvider(
        this.HAML_SELECTOR,
        new PartialSignatureHelpProvider(),
        '(',
        ','
      )
    );

    this.context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        this.HAML_SELECTOR,
        new ViewCodeActionProvider(),
        {
          providedCodeActionKinds: [vscode.CodeActionKind.RefactorExtract]
        }
      )
    );

    this.context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        this.HAML_SELECTOR,
        new CodeLensProvider()
      )
    );
  }

  private registerCommands(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        'hamlAll.createPartialFromSelection',
        createPartialFromSelection
      ),

      vscode.commands.registerCommand(
        'hamlAll.html2Haml',
        html2Haml
      ),

      vscode.commands.registerCommand('hamlAll.livePreview', () => {
        LivePreviewPanel.createOrShow(this.context.extensionUri, this.lintServer);
      }),

      vscode.commands.registerCommand('hamlAll.openFile', (path, lineNumber) => {
        this.outputChannel.appendLine(`Opening file: ${path}:${lineNumber}`);
        openFile(path, lineNumber);
      })
    );
  }
}
