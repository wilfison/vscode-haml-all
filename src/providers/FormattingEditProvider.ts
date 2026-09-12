import {
  CancellationToken,
  CodeAction,
  CodeActionContext,
  CodeActionKind,
  CodeActionProvider,
  DocumentFormattingEditProvider,
  FormattingOptions,
  OutputChannel,
  Range,
  Selection,
  TextDocument,
  TextEdit,
  window,
  WorkspaceEdit,
} from 'vscode';

import Linter from '../linter';
import autoCorrectAll from '../formatter';
import LintServer from '../server';

// `editor.codeActionsOnSave: { "source.fixAll.hamlLint": "explicit" }` and the
// `Source Action...` menu. Kept on the formatting provider so "fix all" and
// "format" are literally the same code path (timeout, pending-lint cancel,
// legacy fallback and the once-per-session warning).
export const FIX_ALL_KIND = CodeActionKind.SourceFixAll.append('hamlLint');
const FIX_ALL_TITLE = 'Fix all auto-correctable haml-lint offenses';

// Carries the document so resolveCodeAction does not have to guess it from the
// active editor (wrong for "Save All" and for background saves).
export class FixAllAction extends CodeAction {
  constructor(public readonly document: TextDocument) {
    super(FIX_ALL_TITLE, FIX_ALL_KIND);
  }
}

export default class FormattingEditProvider implements DocumentFormattingEditProvider, CodeActionProvider {
  private linter: Linter;
  private outputChanel: OutputChannel;
  private lintServer: LintServer;
  private cancelPendingLint: () => void;

  // At most one timeout warning per session: `editor.formatOnSave` on a project
  // with heavy RuboCop cops would otherwise notify on every single save. The
  // first successful format rearms it, so a later real problem is still shown.
  private timeoutWarned = false;

  constructor(linter: Linter, outputChanel: OutputChannel, lintServer: LintServer, cancelPendingLint: () => void = () => {}) {
    this.linter = linter;
    this.outputChanel = outputChanel;
    this.lintServer = lintServer;
    this.cancelPendingLint = cancelPendingLint;
  }

  public async provideDocumentFormattingEdits(
    document: TextDocument,
    _options: FormattingOptions,
    token: CancellationToken | null
  ) {
    return this.computeEdits(document, token);
  }

  // Source actions are never shown in the lightbulb; VS Code only asks for them
  // with `only` set (Source Action... menu, codeActionsOnSave).
  public provideCodeActions(document: TextDocument, _range: Range | Selection, context: CodeActionContext): CodeAction[] {
    if (!this.linter.isEnabled() || !context.only || !context.only.intersects(CodeActionKind.SourceFixAll)) {
      return [];
    }

    // No `edit` yet: computed lazily in resolveCodeAction, so listing the menu
    // costs no server round-trip.
    return [new FixAllAction(document)];
  }

  public async resolveCodeAction(action: FixAllAction, token: CancellationToken): Promise<CodeAction> {
    const edits = await this.computeEdits(action.document, token);

    if (edits.length === 0) {
      return action;
    }

    action.edit = new WorkspaceEdit();
    action.edit.set(action.document.uri, edits);

    return action;
  }

  private async computeEdits(document: TextDocument, token: CancellationToken | null): Promise<TextEdit[]> {
    // Formatting runs through haml-lint, so honour the same switch as linting
    // instead of starting a server request the user asked us not to make.
    if (!this.linter.isEnabled()) {
      return [];
    }

    this.outputChanel.appendLine('Haml All: Formatting document');

    // Drop the debounced lint still waiting: the server handles one request at a
    // time, and that lint would spend the autocorrect's whole timeout budget.
    this.cancelPendingLint();

    const text = document.getText();
    const corrected = await this.autocorrect(document, text);

    // VS Code cancels on `editor.codeActionsOnSaveTimeout`; that is not a
    // failure, so no warning and no stale edit.
    if (token?.isCancellationRequested) {
      return [];
    }

    if (corrected === null) {
      this.warnFormattingFailed();
      return [];
    }

    this.timeoutWarned = false;

    let fixedText = corrected;

    if (this.linter.legacyAutocorrectNeeded()) {
      fixedText = autoCorrectAll(document.fileName, fixedText, this.linter);
    }

    if (fixedText === text) {
      return [];
    }

    // Replace the entire document with the fixed text
    const fullRange = new Range(document.positionAt(0), document.positionAt(text.length));

    return [TextEdit.replace(fullRange, fixedText)];
  }

  private async autocorrect(document: TextDocument, text: string): Promise<string | null> {
    try {
      return await this.lintServer.autocorrect(text, document.fileName, this.linter.configFilePath(document));
    } catch (error) {
      this.outputChanel.appendLine(`Haml All: autocorrect request failed: ${error}`);
      return null;
    }
  }

  private warnFormattingFailed(): void {
    // Every failure is logged, notified or not, so the output channel is always
    // the complete record.
    this.outputChanel.appendLine('Haml All: formatting failed or timed out; the document was left unchanged.');

    if (this.timeoutWarned) {
      return;
    }

    this.timeoutWarned = true;

    window
      .showWarningMessage('HAML formatting timed out. See the "Haml" output for details.', 'Show Output')
      .then((selection) => {
        if (selection === 'Show Output') {
          this.outputChanel.show();
        }
      });
  }
}
