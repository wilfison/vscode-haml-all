import * as vscode from 'vscode';

import { hamlLintPresent } from './Helpers';

import EventSubscriber from './EventSubscriber';
import ViewCompletionProvider from './ViewCompletionProvider';
import ViewFileDefinitionProvider from './ViewFileDefinitionProvider';
import RoutesCompletionProvider from './RoutesCompletionProvider';

import { ViewCodeActionProvider, createPartialFromSelection } from './ViewCodeActionProvider';
import { html2Haml } from './html2Haml';

export async function activate(context: vscode.ExtensionContext) {
  console.log('haml-all active!');

  const config = vscode.workspace.getConfiguration('hamlAll');
  const eventSubscriber = new EventSubscriber(context);

  const HAML_SELECTOR = {
    language: 'haml',
    scheme: 'file'
  };

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

  if (eventSubscriber.isARailsProject) {
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        ['ruby', 'haml'],
        new RoutesCompletionProvider(eventSubscriber.routes),
      )
    );
  }

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

  if (!hamlLintPresent()) {
    vscode.window.showErrorMessage('haml-lint not found. Please install haml-lint gem to use this extension.');
    return;
  }

  if (config.lintEnabled) {
    eventSubscriber.subscribe();
  }
}

// This method is called when your extension is deactivated
export function deactivate() { }
