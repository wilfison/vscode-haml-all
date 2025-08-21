import * as assert from 'assert';
import * as vscode from 'vscode';
import { ViewCodeActionProvider } from '../../providers/ViewCodeActionProvider';

suite('ViewCodeActionProvider Tests', () => {
  let provider: ViewCodeActionProvider;

  setup(() => {
    provider = new ViewCodeActionProvider();
  });

  test('should provide wrap in conditional action for non-empty range', () => {
    const document = {} as vscode.TextDocument;
    const range = new vscode.Range(0, 0, 1, 10); // Non-empty range

    const actions = provider.provideCodeActions(document, range);

    assert.ok(actions);
    assert.ok(actions.length > 0);

    const wrapAction = actions.find(action => action.title === 'Wrap in conditional');
    assert.ok(wrapAction);
    assert.strictEqual(wrapAction.command?.command, 'hamlAll.wrapInConditional');
  });

  test('should not provide wrap in conditional action for empty range', () => {
    const document = {} as vscode.TextDocument;
    const range = new vscode.Range(0, 0, 0, 0); // Empty range

    const actions = provider.provideCodeActions(document, range);

    if (actions) {
      const wrapAction = actions.find(action => action.title === 'Wrap in conditional');
      assert.ok(!wrapAction);
    }
  });

  test('should provide partial action for multi-line range', () => {
    const document = {} as vscode.TextDocument;
    const range = new vscode.Range(0, 0, 5, 10); // Multi-line range

    const actions = provider.provideCodeActions(document, range);

    assert.ok(actions);
    assert.ok(actions.length > 0);

    const partialAction = actions.find(action => action.title === 'Create a partial from selection');
    assert.ok(partialAction);
    assert.strictEqual(partialAction.command?.command, 'hamlAll.createPartialFromSelection');
  });

  test('should not provide partial action for single line range', () => {
    const document = {} as vscode.TextDocument;
    const range = new vscode.Range(0, 0, 0, 10); // Single line range

    const actions = provider.provideCodeActions(document, range);

    if (actions) {
      const partialAction = actions.find(action => action.title === 'Create a partial from selection');
      assert.ok(!partialAction);
    }
  });

  test('should always provide html2haml action', () => {
    const document = {} as vscode.TextDocument;
    const range = new vscode.Range(0, 0, 0, 10);

    const actions = provider.provideCodeActions(document, range);

    assert.ok(actions);
    assert.ok(actions.length > 0);

    const html2HamlAction = actions.find(action => action.title === 'Convert to HAML');
    assert.ok(html2HamlAction);
    assert.strictEqual(html2HamlAction.command?.command, 'hamlAll.html2Haml');
  });
});
