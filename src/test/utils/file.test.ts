import * as assert from 'assert';
import * as path from 'node:path';
import * as vscode from 'vscode';

import { extractPartialNameFromLine, isPartialDocument, toPosix } from '../../utils/file';

// Builds a path with the separator of the platform running the test, which is
// what document.fileName / fsPath actually hand us.
function nativePath(...parts: string[]): string {
  return parts.join(path.sep);
}

suite('utils/file Tests', () => {
  suite('toPosix', () => {
    test('normalizes a native path and leaves a POSIX one alone', () => {
      assert.strictEqual(toPosix(nativePath('app', 'views', 'users', '_row.haml')), 'app/views/users/_row.haml');
      assert.strictEqual(toPosix('app/views/users/_row.haml'), 'app/views/users/_row.haml');
      assert.strictEqual(toPosix(''), '');
    });
  });

  suite('isPartialDocument', () => {
    test('recognizes a partial whatever the platform separator is', () => {
      const partial = {
        languageId: 'haml',
        fileName: nativePath('', 'project', 'app', 'views', 'users', '_row.html.haml'),
      } as vscode.TextDocument;

      const view = {
        languageId: 'haml',
        fileName: nativePath('', 'project', 'app', 'views', 'users', 'index.html.haml'),
      } as vscode.TextDocument;

      assert.strictEqual(isPartialDocument(partial), true);
      assert.strictEqual(isPartialDocument(view), false);
    });
  });

  suite('extractPartialNameFromLine', () => {
    test('resolves the partial name for every render syntax', () => {
      assert.strictEqual(extractPartialNameFromLine("= render 'shared/header'"), 'shared/_header');
      assert.strictEqual(extractPartialNameFromLine("= render('form')"), '_form');
      assert.strictEqual(extractPartialNameFromLine("= render partial: 'users/row'"), 'users/_row');
    });

    test('returns an empty string for lines that only contain the word "render"', () => {
      assert.strictEqual(extractPartialNameFromLine('%p= @rendered_count'), '');
      assert.strictEqual(extractPartialNameFromLine('= render_to_string(@x)'), '');
      assert.strictEqual(extractPartialNameFromLine('= content_for :rendered'), '');
      assert.strictEqual(extractPartialNameFromLine('-# rendered'), '');
      assert.strictEqual(extractPartialNameFromLine(''), '');
    });
  });
});
