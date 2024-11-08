import {
  workspace,
  languages,
  CodeActionKind,
  TextDocument,
  ExtensionContext,
  FileSystemWatcher,
} from 'vscode';

import Linter from './Linter';
import FixActionsProvider from './FixActionsProvider';
import { autoCorrectAll } from './autoCorrect';

class EventSubscriber {
  private context: ExtensionContext;
  private linter: Linter;
  private hamlLintWatcher: FileSystemWatcher;
  private ruboCopWatcher: FileSystemWatcher;

  constructor(context: ExtensionContext) {
    this.context = context;
    this.linter = new Linter();

    this.hamlLintWatcher = workspace.createFileSystemWatcher('**/.haml-lint.yml');
    this.ruboCopWatcher = workspace.createFileSystemWatcher('**/.rubocop.yml');
  }

  public subscribe() {
    this.subscribeToEvents();
    this.subscribeToWatchers();
  }

  public unsubscribe() {
    this.context.subscriptions.forEach(subscription => subscription.dispose());
  }

  public updateAllDiagnostics() {
    workspace.textDocuments.forEach(document => this.linter.run(document));
  }

  private subscribeToEvents() {
    const updateDiagnostics = (document: TextDocument) => this.linter.run(document);

    this.context.subscriptions.push(this.linter);

    this.context.subscriptions.push(
      workspace.onDidSaveTextDocument(async (document: TextDocument) => {
        if (workspace.getConfiguration('hamlAll').simpleAutoFixOnSave) {
          await autoCorrectAll(document);
        }

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

  private subscribeToWatchers() {
    this.hamlLintWatcher.onDidChange(() => this.updateAllDiagnostics());
    this.ruboCopWatcher.onDidChange(() => this.updateAllDiagnostics());
  }
}

export default EventSubscriber;
