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
  Range,
  Selection,
} from 'vscode';

import { SOURCE } from '../linter';
import { hamlLintFixes, rubocopFix } from '../quick_fixes';
import { fixAllStringLiterals } from '../quick_fixes/stringLiterals';
import { DiagnosticFull } from '../linter/parser';

export default class FixActionsProvider implements CodeActionProvider {
  private codeActions: CodeAction[];

  constructor() {
    this.codeActions = [];
  }

  provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: any): CodeAction[] {
    this.codeActions = [];
    const diagnostics = this.filterWarnings(context);

    this.createGlobalRubocopActions(document, diagnostics);
    this.createSwitchQuotesAction(document, range);

    diagnostics.forEach((diagnostic) => {
      this.createLintAction(document, diagnostic, diagnostic.source);
    });

    return this.codeActions;
  }

  private filterWarnings(diagnostics: CodeActionContext): DiagnosticFull[] {
    const filtred = diagnostics.diagnostics.filter(
      (diagnostic) => diagnostic.source === SOURCE && diagnostic.severity === DiagnosticSeverity.Warning
    ) as DiagnosticFull[];

    return filtred;
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
    let position = new Position(0, 0);

    // Avoid adding the disable comment at the top of `locals` comment
    if (document.lineAt(0).text.startsWith('-# locals:')) {
      position = new Position(1, 0);
    }

    edit.insert(document.uri, position, `-# ${disable} ${rule}\n`);

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

  private createSwitchQuotesAction(document: TextDocument, range: Range | Selection) {
    const text = document.getText(range);
    const quote = text[0] === text.slice(-1) ? text[0] : '';

    if (['"', "'"].includes(quote) === false) {
      return;
    }

    const inverseQuote = quote === '"' ? "'" : '"';
    const quoteName = inverseQuote === '"' ? 'double' : 'single';

    const action = new CodeAction(`Change to ${quoteName} quotes`, CodeActionKind.QuickFix);
    action.edit = new WorkspaceEdit();

    action.edit.replace(document.uri, range, `${inverseQuote}${text.slice(1, -1)}${inverseQuote}`);

    this.codeActions.push(action);
  }
}
