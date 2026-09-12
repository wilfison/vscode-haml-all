import * as assert from 'assert';
import * as vscode from 'vscode';

import FixActionsProvider from '../../providers/FixActionsProvider';
import { DiagnosticFull } from '../../linter/parser';

function diagnostic(
  source: string,
  rule: string,
  message: string,
  severity = vscode.DiagnosticSeverity.Warning,
  range = new vscode.Range(0, 0, 0, 20)
): DiagnosticFull {
  return new DiagnosticFull(range, message, { value: rule, target: vscode.Uri.parse('https://example.test') }, source, severity);
}

function context(diagnostics: vscode.Diagnostic[]): vscode.CodeActionContext {
  return {
    diagnostics,
    only: undefined,
    triggerKind: vscode.CodeActionTriggerKind.Invoke,
  };
}

async function hamlDocument(content: string): Promise<vscode.TextDocument> {
  return vscode.workspace.openTextDocument({ content, language: 'haml' });
}

function titles(actions: vscode.CodeAction[]): string[] {
  return actions.map((action) => action.title);
}

function insertedText(action: vscode.CodeAction, uri: vscode.Uri): string {
  const edits = action.edit?.get(uri) || [];
  return edits.map((edit) => edit.newText).join('');
}

suite('FixActionsProvider Tests', () => {
  let provider: FixActionsProvider;

  setup(() => {
    provider = new FixActionsProvider();
  });

  test('offers the fix and the disable action for a haml-lint warning', async () => {
    const document = await hamlDocument('=foo');
    const range = new vscode.Range(0, 0, 0, 4);
    const diagnostics = [diagnostic('haml-lint', 'SpaceBeforeScript', 'SpaceBeforeScript: `=` should be followed by a space')];

    const actions = provider.provideCodeActions(document, range, context(diagnostics), null);

    assert.deepStrictEqual(titles(actions), ['Fix SpaceBeforeScript', 'Disable `SpaceBeforeScript` for this entire file']);
  });

  test('offers the same actions when the offense severity is error', async () => {
    const document = await hamlDocument('=foo');
    const range = new vscode.Range(0, 0, 0, 4);
    const diagnostics = [
      diagnostic(
        'haml-lint',
        'SpaceBeforeScript',
        'SpaceBeforeScript: `=` should be followed by a space',
        vscode.DiagnosticSeverity.Error
      ),
    ];

    const actions = provider.provideCodeActions(document, range, context(diagnostics), null);

    assert.deepStrictEqual(titles(actions), ['Fix SpaceBeforeScript', 'Disable `SpaceBeforeScript` for this entire file']);
  });

  test('offers the RuboCop fixes and disables the whole RuboCop linter', async () => {
    const document = await hamlDocument('%p{class: "a"}');
    const range = new vscode.Range(0, 0, 0, 14);
    const diagnostics = [
      diagnostic('RuboCop', 'Style/StringLiterals', 'Style/StringLiterals: Prefer single-quoted strings', undefined, range),
    ];

    const actions = provider.provideCodeActions(document, range, context(diagnostics), null);
    const actionTitles = titles(actions);

    assert.ok(actionTitles.includes('Autocorrect all occurrences Style/StringLiterals'), actionTitles.join(' | '));
    assert.ok(actionTitles.includes('Autocorrect Style/StringLiterals'), actionTitles.join(' | '));
    assert.ok(actionTitles.includes('Disable `RuboCop` for this entire file'), actionTitles.join(' | '));

    const disableAction = actions.find((action) => action.title === 'Disable `RuboCop` for this entire file');
    assert.strictEqual(insertedText(disableAction!, document.uri), '-# haml-lint:disable RuboCop\n');
  });

  test('offers only the disable action for a cop without a known fix', async () => {
    const document = await hamlDocument('%p very long line');
    const range = new vscode.Range(0, 0, 0, 17);
    const diagnostics = [diagnostic('haml-lint', 'LineLength', 'LineLength: Line is too long', undefined, range)];

    const actions = provider.provideCodeActions(document, range, context(diagnostics), null);

    assert.deepStrictEqual(titles(actions), ['Disable `LineLength` for this entire file']);
  });

  test('ignores diagnostics from other sources', async () => {
    const document = await hamlDocument('%p hello');
    const range = new vscode.Range(0, 0, 0, 8);
    const other = new vscode.Diagnostic(range, 'something else', vscode.DiagnosticSeverity.Warning);
    other.source = 'eslint';

    const actions = provider.provideCodeActions(document, range, context([other]), null);

    assert.deepStrictEqual(actions, []);
  });

  suite('Change quotes action', () => {
    async function quoteActionTitles(content: string): Promise<string[]> {
      const document = await hamlDocument(content);
      const range = new vscode.Range(0, 0, 0, content.length);
      const provider = new FixActionsProvider();

      const actions = provider.provideCodeActions(document, range, context([]), null);

      return titles(actions).filter((title) => title.startsWith('Change to'));
    }

    test('is offered for a single string literal', async () => {
      assert.deepStrictEqual(await quoteActionTitles('"abc"'), ['Change to single quotes']);
      assert.deepStrictEqual(await quoteActionTitles("'abc'"), ['Change to double quotes']);
    });

    test('is not offered for a selection that is more than one literal', async () => {
      assert.deepStrictEqual(await quoteActionTitles('"a" + "b"'), []);
      assert.deepStrictEqual(await quoteActionTitles("'it\\'s'"), []);
      assert.deepStrictEqual(await quoteActionTitles('no quotes here'), []);
      assert.deepStrictEqual(await quoteActionTitles('"'), []);
    });
  });
});
