import * as assert from 'assert';
import * as vscode from 'vscode';

import FixActionsProvider from '../../providers/FixActionsProvider';
import { DiagnosticFull } from '../../linter/parser';

function diagnostic(
  source: string,
  rule: string,
  message: string,
  severity = vscode.DiagnosticSeverity.Warning,
  range = new vscode.Range(0, 0, 0, 20),
  correctable = false
): DiagnosticFull {
  return new DiagnosticFull(
    range,
    message,
    { value: rule, target: vscode.Uri.parse('https://example.test') },
    source,
    severity,
    correctable
  );
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

  suite('haml-lint autocorrect action', () => {
    const range = new vscode.Range(0, 0, 0, 4);
    const trailing = (correctable: boolean) =>
      diagnostic('haml-lint', 'TrailingWhitespace', 'TrailingWhitespace: trailing', undefined, range, correctable);

    // Records the linters it was asked for and answers with the queued text.
    function fakeAutocorrect(result: string | null) {
      const calls: string[][] = [];
      const fn = async (_document: vscode.TextDocument, linters: string[]) => {
        calls.push(linters);
        return result;
      };
      return { fn, calls };
    }

    test('is offered before the disable action for a correctable offense', async () => {
      const document = await hamlDocument('%p a ');

      const actions = provider.provideCodeActions(document, range, context([trailing(true)]), null);

      assert.deepStrictEqual(titles(actions), [
        'Fix all `TrailingWhitespace` offenses in this file (haml-lint autocorrect)',
        'Disable `TrailingWhitespace` for this entire file',
      ]);
      assert.strictEqual(actions[0].edit, undefined);
      assert.deepStrictEqual(actions[0].diagnostics, [trailing(true)]);
    });

    test('is not offered when the offense is not correctable', async () => {
      const document = await hamlDocument('%p a ');

      const actions = provider.provideCodeActions(document, range, context([trailing(false)]), null);

      assert.deepStrictEqual(titles(actions), ['Disable `TrailingWhitespace` for this entire file']);
    });

    test('a local fix takes precedence over it', async () => {
      const document = await hamlDocument('=foo');
      const diagnostics = [diagnostic('haml-lint', 'SpaceBeforeScript', 'SpaceBeforeScript: x', undefined, range, true)];

      const actions = provider.provideCodeActions(document, range, context(diagnostics), null);

      assert.deepStrictEqual(titles(actions), ['Fix SpaceBeforeScript', 'Disable `SpaceBeforeScript` for this entire file']);
    });

    test('a RuboCop offense fixes the whole RuboCop linter', async () => {
      const document = await hamlDocument('%p a ');
      const autocorrect = fakeAutocorrect('%p a');
      const provider = new FixActionsProvider(autocorrect.fn);
      const diagnostics = [diagnostic('RuboCop', 'Layout/TrailingWhitespace', 'Layout/TrailingWhitespace: x', undefined, range, true)];

      const actions = provider.provideCodeActions(document, range, context(diagnostics), null);
      const action = actions.find((a) => a.title === 'Fix all RuboCop offenses in this file (haml-lint autocorrect)');
      assert.ok(action, titles(actions).join(' | '));

      await provider.resolveCodeAction(action!);

      assert.deepStrictEqual(autocorrect.calls, [['RuboCop']]);
    });

    test('resolves to a full-document replace with the corrected text', async () => {
      const document = await hamlDocument('%p a ');
      const autocorrect = fakeAutocorrect('%p a');
      const provider = new FixActionsProvider(autocorrect.fn);

      const [action] = provider.provideCodeActions(document, range, context([trailing(true)]), null);
      const resolved = await provider.resolveCodeAction(action);

      assert.deepStrictEqual(autocorrect.calls, [['TrailingWhitespace']]);
      const edits = resolved.edit?.get(document.uri) || [];
      assert.strictEqual(edits.length, 1);
      assert.strictEqual(edits[0].newText, '%p a');
      assert.ok(edits[0].range.isEqual(new vscode.Range(0, 0, 0, 5)));
    });

    test('resolves without an edit when the text does not change', async () => {
      const document = await hamlDocument('%p a ');
      const provider = new FixActionsProvider(fakeAutocorrect('%p a ').fn);
      const original = vscode.window.showInformationMessage;
      let messages: string[] = [];
      (vscode.window as any).showInformationMessage = (message: string) => {
        messages.push(message);
        return Promise.resolve(undefined);
      };

      try {
        const [action] = provider.provideCodeActions(document, range, context([trailing(true)]), null);
        const resolved = await provider.resolveCodeAction(action);

        assert.strictEqual(resolved.edit, undefined);
        assert.deepStrictEqual(messages, ['haml-lint could not autocorrect TrailingWhitespace. See the "Haml" output for details.']);
      } finally {
        (vscode.window as any).showInformationMessage = original;
      }
    });
  });
});
