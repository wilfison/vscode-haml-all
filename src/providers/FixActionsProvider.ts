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
  window,
} from 'vscode';

import { SOURCE } from '../linter';
import { hamlLintFixes, rubocopFix } from '../quick_fixes';
import { fixAllStringLiterals } from '../quick_fixes/stringLiterals';
import { DiagnosticFull } from '../linter/parser';

const RUBOCOP_SOURCE = 'RuboCop';

// Sources this provider knows how to act on. RuboCop offenses arrive through
// haml-lint but carry their own source (see linter/parser.ts).
const LINTER_SOURCES = [SOURCE, RUBOCOP_SOURCE];

/** Runs haml-lint's safe autocorrect restricted to `linters`; null on failure. */
export type AutocorrectFn = (document: TextDocument, linters: string[]) => Promise<string | null>;

// haml-lint cannot fix a single line: the smallest unit is a linter, and the whole of
// RuboCop for its cops. Resolved lazily, so the lightbulb costs no server round-trip.
class AutocorrectAction extends CodeAction {
  constructor(
    public readonly document: TextDocument,
    public readonly rule: string,
    public readonly linters: string[],
    diagnostic: DiagnosticFull
  ) {
    const scope = linters[0] === RUBOCOP_SOURCE ? 'RuboCop' : `\`${rule}\``;
    super(`Fix all ${scope} offenses in this file (haml-lint autocorrect)`, CodeActionKind.QuickFix);
    this.diagnostics = [diagnostic];
  }
}

export default class FixActionsProvider implements CodeActionProvider {
  private codeActions: CodeAction[];
  private autocorrect: AutocorrectFn;

  constructor(autocorrect: AutocorrectFn = async () => null) {
    this.codeActions = [];
    this.autocorrect = autocorrect;
  }

  async resolveCodeAction(action: CodeAction): Promise<CodeAction> {
    if (!(action instanceof AutocorrectAction)) {
      return action;
    }

    const text = action.document.getText();
    const fixed = await this.autocorrect(action.document, action.linters);

    if (fixed === null) {
      // The autocorrect path already logged/warned about the failure.
      return action;
    }

    if (fixed === text) {
      // `correctable` only says the cop has an autocorrect, not that it applies
      // to this code (or that the cop is enabled in .haml-lint.yml).
      window.showInformationMessage(`haml-lint could not autocorrect ${action.rule}. See the "Haml" output for details.`);
      return action;
    }

    action.edit = new WorkspaceEdit();
    action.edit.replace(
      action.document.uri,
      new Range(action.document.positionAt(0), action.document.positionAt(text.length)),
      fixed
    );

    return action;
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
    } else if (diagnostic.correctable) {
      // A local fix is instant and per-line, so it wins when there is one.
      const linters = linter === SOURCE ? [rule] : [RUBOCOP_SOURCE];
      this.codeActions.push(new AutocorrectAction(document, rule, linters, diagnostic));
    }

    // haml-lint has no directive for a single RuboCop cop: disabling one disables the
    // whole RuboCop linter for the file.
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

    // Only for a single string literal: same quote at both ends and not in between,
    // since comparing just the ends turns `"a" + "b"` into `'a" + "b'`.
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
