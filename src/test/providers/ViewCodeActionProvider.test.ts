import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  ViewCodeActionProvider,
  formatPartialVariables,
  globalVariableList,
  resolvePartialTarget,
  sanitizePartialName,
} from '../../providers/ViewCodeActionProvider';

suite('ViewCodeActionProvider Tests', () => {
  let provider: ViewCodeActionProvider;

  setup(() => {
    provider = new ViewCodeActionProvider();
  });

  test('should provide wrap in conditional action', () => {
    const document = {} as vscode.TextDocument;
    const range = new vscode.Range(0, 0, 1, 10);

    const actions = provider.provideCodeActions(document, range);

    assert.ok(actions);
    assert.ok(actions.length > 0);

    const wrapAction = actions.find(action => action.title === 'Wrap in conditional');
    assert.ok(wrapAction);
    assert.strictEqual(wrapAction.command?.command, 'hamlAll.wrapInConditional');
  });

  test('should provide wrap in a ruby block action', () => {
    const document = {} as vscode.TextDocument;
    const range = new vscode.Range(0, 0, 1, 10);

    const actions = provider.provideCodeActions(document, range);

    assert.ok(actions);
    assert.ok(actions.length > 0);

    const wrapAction = actions.find(action => action.title === 'Wrap in a ruby block');
    assert.ok(wrapAction);
    assert.strictEqual(wrapAction.command?.command, 'hamlAll.wrapInBlock');
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

  suite('globalVariableList', () => {
    test('ignores an email address and a class variable', () => {
      assert.deepStrictEqual(globalVariableList('%a{href: "mailto:foo@bar.com"} Mail'), []);
      assert.deepStrictEqual(globalVariableList('%p= @@count'), []);
      assert.deepStrictEqual(globalVariableList('%p @'), []);
    });

    test('collects instance variables, longest first', () => {
      assert.deepStrictEqual(globalVariableList('%p= @user_id\n%p= @user'), ['@user_id', '@user']);
    });
  });

  suite('formatPartialVariables', () => {
    test('replaces a variable without touching a longer one that starts the same', () => {
      const content = '%p= @user_id\n%p= @user.name';
      const result = formatPartialVariables(['@user_id', '@user'], content);

      assert.ok(result.startsWith('-# locals: (user_id:, user:)\n\n'), result);
      assert.ok(result.includes('%p= user_id'), result);
      assert.ok(result.includes('%p= user.name'), result);
      assert.ok(!result.includes('@'), result);
    });
  });

  suite('sanitizePartialName', () => {
    test('keeps directories and drops the leading underscore of the file name', () => {
      assert.strictEqual(sanitizePartialName(' shared/foo '), 'shared/foo');
      assert.strictEqual(sanitizePartialName('shared/_foo'), 'shared/foo');
      assert.strictEqual(sanitizePartialName('my form'), 'my_form');
    });

    test('refuses traversal, absolute paths and empty names', () => {
      assert.strictEqual(sanitizePartialName('../x'), null);
      assert.strictEqual(sanitizePartialName('shared/../x'), null);
      assert.strictEqual(sanitizePartialName('/etc/passwd'), null);
      assert.strictEqual(sanitizePartialName('   '), null);
      assert.strictEqual(sanitizePartialName('___'), null);
    });
  });

  suite('resolvePartialTarget', () => {
    const view = '/ws/app/views/users/index.html.haml';

    test('resolves a name with a directory from app/views', () => {
      assert.deepStrictEqual(resolvePartialTarget(view, 'shared/foo'), {
        filePath: '/ws/app/views/shared/_foo.html.haml',
        renderName: 'shared/foo',
      });
    });

    test('resolves a bare name next to the current view', () => {
      assert.deepStrictEqual(resolvePartialTarget(view, 'row'), {
        filePath: '/ws/app/views/users/_row.html.haml',
        renderName: 'users/row',
      });
    });

    test('falls back to a sibling file outside app/views', () => {
      assert.deepStrictEqual(resolvePartialTarget('/ws/tmp/page.haml', 'row'), {
        filePath: '/ws/tmp/_row.html.haml',
        renderName: 'row',
      });
    });
  });
});
