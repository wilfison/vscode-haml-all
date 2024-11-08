import {
  CodeActionProvider,
  TextDocument,
  CodeActionContext,
  CodeAction,
  DiagnosticSeverity,
  Diagnostic,
  CodeActionKind,
  WorkspaceEdit,
  Position,
} from 'vscode';

import { SOURCE } from './Linter';

export default class FixActionsProvider implements CodeActionProvider {
  provideCodeActions(document: TextDocument, range: any, context: CodeActionContext, token: any): CodeAction[] {
    const warnings = this.filterWarnings(context);

    return warnings.length > 0 ? this.createActions(document, warnings) : [];
  }

  private filterWarnings(diagnostics: CodeActionContext): Diagnostic[] {
    return diagnostics.diagnostics.filter(
      (diagnostic) =>
        diagnostic.source === SOURCE &&
        diagnostic.severity === DiagnosticSeverity.Warning
    );
  }

  private createActions(document: TextDocument, diagnostics: Diagnostic[]): CodeAction[] {
    return diagnostics.map((diagnostic) => {
      switch (diagnostic.code) {
        case 'RuboCop':
          return this.createRubocopAction(document, diagnostic);
        default:
          return this.createHamlLintAction(document, diagnostic);
      }
    });
  }

  private createHamlLintAction(document: TextDocument, diagnostic: Diagnostic): CodeAction {
    const fix = new CodeAction(`Disable ${diagnostic.code} for this entire file`, CodeActionKind.QuickFix);
    fix.edit = this.createWorkspaceEdit(document, diagnostic.code as string, 'haml-lint:disable');

    return fix;
  }

  private createRubocopAction(document: TextDocument, diagnostic: Diagnostic): CodeAction {
    const rule = diagnostic.message.split(':')[0];
    const fix = new CodeAction(`Disable ${rule} for this entire file`, CodeActionKind.QuickFix);
    fix.edit = this.createWorkspaceEdit(document, rule, 'rubocop:disable', 'rubocop:enable');

    return fix;
  }

  private createWorkspaceEdit(
    document: TextDocument,
    rule: string,
    disableDirective: string,
    enableDirective?: string
  ): WorkspaceEdit {
    const edit = new WorkspaceEdit();
    edit.insert(document.uri, new Position(0, 0), `-# ${disableDirective} ${rule}\n`);

    if (enableDirective) {
      edit.insert(document.uri, new Position(document.lineCount + 1, 0), `-# ${enableDirective} ${rule}\n`);
    }

    return edit;
  }
}
