import * as assert from 'assert';
import * as path from 'node:path';
import * as vscode from 'vscode';

import CodeLensProvider, { resolveControllerPath } from '../../providers/CodeLensProvider';

suite('CodeLensProvider Tests', () => {
  suite('resolveControllerPath', () => {
    // The workspace root itself contains a directory called "app": searching the
    // absolute path for the first "/app/" used to win and break the lookup.
    const root = path.join(path.sep, 'home', 'x', 'app', 'projeto');

    test('resolves the controller for a view, even when the root contains /app/', () => {
      const view = path.join(root, 'app', 'views', 'users', 'index.html.haml');

      assert.strictEqual(
        resolveControllerPath(root, view),
        path.join(root, 'app', 'controllers', 'users_controller.rb')
      );
    });

    test('resolves a namespaced view', () => {
      const view = path.join(root, 'app', 'views', 'admin', 'users', 'index.html.haml');

      assert.strictEqual(
        resolveControllerPath(root, view),
        path.join(root, 'app', 'controllers', 'admin', 'users_controller.rb')
      );
    });

    test('returns an empty string for a file outside app/views', () => {
      assert.strictEqual(resolveControllerPath(root, path.join(root, 'app', 'models', 'user.rb')), '');
      assert.strictEqual(resolveControllerPath(root, path.join(root, 'app', 'views', 'layout.html.haml')), '');
      assert.strictEqual(resolveControllerPath(root, path.join(path.sep, 'elsewhere', 'a.haml')), '');
    });
  });

  test('provides no lens for a document outside any workspace folder', () => {
    const provider = new CodeLensProvider();
    const document = {
      uri: vscode.Uri.file(path.join(path.sep, 'tmp', 'haml-all-no-folder', 'app', 'views', 'users', 'index.html.haml')),
      fileName: path.join(path.sep, 'tmp', 'haml-all-no-folder', 'app', 'views', 'users', 'index.html.haml'),
      languageId: 'haml',
      lineAt: () => ({ range: new vscode.Range(0, 0, 0, 0) }),
    } as any;

    assert.deepStrictEqual(provider.provideCodeLenses(document, null as any), []);
  });
});
