import {
  CodeActionProvider,
  TextDocument,
  CodeActionContext,
  CodeAction,
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

const RUBOCOP_SOURCE = 'RuboCop';

// Sources this provider knows how to act on. RuboCop offenses arrive through
// haml-lint but carry their own source (see linter/parser.ts).
const LINTER_SOURCES = [SOURCE, RUBOCOP_SOURCE];

export default class FixActionsProvider implements CodeActionProvider {
  private codeActions: CodeAction[];

  constructor() {
    this.codeActions = [];
  }

  provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: any): CodeAction[] {
    this.codeActions = [];
    const diagnostics = this.filterDiagnostics(context);

    this.createGlobalRubocopActions(document, diagnostics);
    this.createSwitchQuotesAction(document, range);

    diagnostics.forEach((diagnostic) => {
      this.createLintAction(document, diagnostic, diagnostic.source);
    });

    return this.codeActions;
  }

  // Severity is not a filter: haml-lint reports some cops as errors, and those
  // have the same fixes available as the warnings.
  private filterDiagnostics(context: CodeActionContext): DiagnosticFull[] {
    return context.diagnostics.filter((diagnostic) => LINTER_SOURCES.includes(diagnostic.source || '')) as DiagnosticFull[];
  }

  private createLintAction(document: TextDocument, diagnostic: DiagnosticFull, linter: string) {
    const rule = diagnostic.code.value;
    const fix = linter === SOURCE ? hamlLintFixes(rule, document, diagnostic) : rubocopFix(rule, document, diagnostic);

    if (fix) {
      this.codeActions.push(fix);
    }

    // haml-lint has no directive for a single RuboCop cop — disabling one means
    // disabling the whole RuboCop linter for the file.
    const disableRule = linter === SOURCE ? rule : RUBOCOP_SOURCE;

    const disableFix = new CodeAction(`Disable \`${disableRule}\` for this entire file`, CodeActionKind.QuickFix);
    disableFix.edit = this.createWorkspaceEdit(document, disableRule, `${SOURCE}:disable`);

    this.codeActions.push(disableFix);
  }

  private createWorkspaceEdit(document: TextDocument, rule: string, disable: string) {
    const edit = new WorkspaceEdit();
    let position = new Position(0, 0);

    // Avoid adding the disable comment at the top of `locals` comment
    if (document.lineAt(0).text.startsWith('-# locals:')) {
      position = new Position(1, 0);
    }

    edit.insert(document.uri, position, `-# ${disable} ${rule}\n`);

    return edit;
  }

  private createGlobalRubocopActions(document: TextDocument, diagnostics: Diagnostic[]) {
    const rubocopDiagnostics = diagnostics.filter((diagnostic) => diagnostic.source === RUBOCOP_SOURCE);

    if (rubocopDiagnostics.length === 0) {
      return;
    }

    let actions = [];
    actions.push(fixAllStringLiterals(document, rubocopDiagnostics));

    actions = actions.filter((action) => action !== null);

    this.codeActions.push(...actions);
  }

  private createSwitchQuotesAction(document: TextDocument, range: Range | Selection) {
    const text = document.getText(range);
    const quote = text[0];

    // Offer this only for a single string literal: same quote at both ends and
    // not in between. Comparing just the ends turns `"a" + "b"` into
    // `'a" + "b'`.
    if (['"', "'"].includes(quote) === false || text.length < 2 || text.at(-1) !== quote) {
      return;
    }

    if (text.slice(1, -1).includes(quote)) {
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
