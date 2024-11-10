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
import { rubocopFixes } from './quick_fixes';
import { fixAllStringLiterals } from './quick_fixes/stringLiterals';

export default class FixActionsProvider implements CodeActionProvider {
  private codeActions: CodeAction[];

  constructor() {
    this.codeActions = [];
  }

  provideCodeActions(document: TextDocument, range: any, context: CodeActionContext, token: any): CodeAction[] {
    this.codeActions = [];
    const warnings = this.filterWarnings(context);

    this.createGlobalRubocopActions(document, warnings);
    this.createActions(document, warnings);

    return this.codeActions;
  }

  private filterWarnings(diagnostics: CodeActionContext): Diagnostic[] {
    return diagnostics.diagnostics.filter(
      (diagnostic) =>
        diagnostic.source === SOURCE &&
        diagnostic.severity === DiagnosticSeverity.Warning
    );
  }

  private createActions(document: TextDocument, diagnostics: Diagnostic[]) {
    diagnostics.forEach((diagnostic) => {
      switch (diagnostic.code) {
        case 'RuboCop':
          this.createRubocopAction(document, diagnostic);
        default:
          this.createHamlLintAction(document, diagnostic);
      }
    });
  }

  private createHamlLintAction(document: TextDocument, diagnostic: Diagnostic) {
    const disableFix = new CodeAction(`Disable ${diagnostic.code} for this entire file`, CodeActionKind.QuickFix);
    disableFix.edit = this.createWorkspaceEdit(document, diagnostic.code as string, 'haml-lint:disable');

    this.codeActions.push(disableFix);
  }

  private createRubocopAction(document: TextDocument, diagnostic: Diagnostic) {
    const rule = diagnostic.message.split(':')[0].trim() as keyof typeof rubocopFixes;
    const fix = rubocopFixes[rule] as Function | undefined;

    if (fix) {
      const customFix = fix(document, diagnostic) as CodeAction;
      this.codeActions.push(customFix);
    }

    const disableFix = new CodeAction(`Disable ${rule} for this entire file`, CodeActionKind.QuickFix);
    disableFix.edit = this.createWorkspaceEdit(document, rule, 'rubocop:disable', 'rubocop:enable');

    this.codeActions.push(disableFix);
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

  private createGlobalRubocopActions(document: TextDocument, diagnostics: Diagnostic[]) {
    const rubocopDiagnostics = diagnostics.filter((diagnostic) => diagnostic.code === 'RuboCop');

    if (rubocopDiagnostics.length === 0) {
      return;
    }

    let actions = [];
    actions.push(fixAllStringLiterals(document, diagnostics));

    actions = actions.filter((action) => action !== null);

    this.codeActions.push(...actions);
  }
}
