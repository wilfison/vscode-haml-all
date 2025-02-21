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

import { SOURCE } from './linter';
import { hamlLintFixes, rubocopFix } from './quick_fixes';
import { fixAllStringLiterals } from './quick_fixes/stringLiterals';
import { DiagnosticFull } from './linter/parser';

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

  private filterWarnings(diagnostics: CodeActionContext): DiagnosticFull[] {
    const filtred = diagnostics.diagnostics.filter(
      (diagnostic) =>
        diagnostic.source === SOURCE &&
        diagnostic.severity === DiagnosticSeverity.Warning
    ) as DiagnosticFull[];

    return filtred;
  }

  private createActions(document: TextDocument, diagnostics: DiagnosticFull[]) {
    diagnostics.forEach((diagnostic) => {
      this.createLintAction(document, diagnostic, diagnostic.source);
    });
  }

  private createLintAction(document: TextDocument, diagnostic: DiagnosticFull, linter: string) {
    const rule = diagnostic.code.value;
    const fix = linter === 'haml-lint' ? hamlLintFixes(rule, document, diagnostic) : rubocopFix(rule, document, diagnostic);

    if (fix) {
      this.codeActions.push(fix);
    }

    const disableFix = new CodeAction(`Disable \`${diagnostic.code.value}\` for this entire file`, CodeActionKind.QuickFix);
    disableFix.edit = this.createWorkspaceEdit(document, rule, `${linter}:disable`);

    this.codeActions.push(disableFix);
  }

  private createWorkspaceEdit(document: TextDocument, rule: string, disable: string, enable?: string) {
    const edit = new WorkspaceEdit();
    edit.insert(document.uri, new Position(0, 0), `-# ${disable} ${rule}\n`);

    if (enable) {
      edit.insert(document.uri, new Position(document.lineCount + 1, 0), `-# ${enable} ${rule}\n`);
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
