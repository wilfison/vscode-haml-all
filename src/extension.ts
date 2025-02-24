import * as vscode from 'vscode';

import { hamlLintPresent } from './Helpers';

import EventSubscriber from './EventSubscriber';
import ViewCompletionProvider from './providers/ViewCompletionProvider';
import ViewFileDefinitionProvider from './providers/ViewFileDefinitionProvider';
import RoutesCompletionProvider from './providers/RoutesCompletionProvider';
import RoutesDefinitionProvider from './providers/RoutesDefinitionProvider';
import PartialSignatureHelpProvider from './providers/PartialSignatureHelpProvider';

import { ViewCodeActionProvider, createPartialFromSelection } from './providers/ViewCodeActionProvider';
import { html2Haml } from './html2Haml';
import FormattingEditProvider from './providers/FormattingEditProvider';
import LivePreviewPanel from './LivePreviewPanel';

export function activate(context: vscode.ExtensionContext) {
  console.log('haml-all active!');

  const outputChanel = vscode.window.createOutputChannel('Haml');
  const config = vscode.workspace.getConfiguration('hamlAll');
  const eventSubscriber = new EventSubscriber(context, outputChanel);

  const HAML_SELECTOR = { language: 'haml', scheme: 'file' };
  const RUBY_SELECTOR = { language: 'ruby', scheme: 'file' };

  if (eventSubscriber.isARailsProject) {
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        [RUBY_SELECTOR, HAML_SELECTOR],
        new RoutesCompletionProvider(eventSubscriber.routes),
      )
    );

    context.subscriptions.push(
      vscode.languages.registerDefinitionProvider(
        HAML_SELECTOR,
        new RoutesDefinitionProvider(eventSubscriber.routes)
      )
    );

    eventSubscriber.subscribeRails();
  }

  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      HAML_SELECTOR,
      new FormattingEditProvider(eventSubscriber.linter, outputChanel)
    )
  );

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(HAML_SELECTOR, new ViewFileDefinitionProvider())
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      HAML_SELECTOR,
      new ViewCompletionProvider(),
      '"',
      '\''
    )
  );

  context.subscriptions.push(
    vscode.languages.registerSignatureHelpProvider(
      HAML_SELECTOR,
      new PartialSignatureHelpProvider(),
      '(',
      ','
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      HAML_SELECTOR,
      new ViewCodeActionProvider(),
      {
        providedCodeActionKinds: [vscode.CodeActionKind.RefactorExtract]
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'hamlAll.createPartialFromSelection',
      createPartialFromSelection
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'hamlAll.html2Haml',
      html2Haml
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('hamlAll.livePreview', () => {
      LivePreviewPanel.createOrShow(context.extensionUri);
    })
  );

  if (!hamlLintPresent()) {
    vscode.window.showErrorMessage('haml-lint not found. Please install haml-lint gem to use this extension.');
    return;
  }

  if (config.lintEnabled) {
    eventSubscriber.subscribeHaml();
  }
}

// This method is called when your extension is deactivated
export function deactivate() {
  console.log('haml-all deactivated!');
}
