import * as assert from 'assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

import { extractPartialNameFromLine, fileStringLocals, isPartialDocument, toPosix } from '../../utils/file';

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

    test('resolves the collection or object a render names', () => {
      assert.strictEqual(extractPartialNameFromLine('= render @user'), '_user');
      assert.strictEqual(extractPartialNameFromLine('= render user'), '_user');
      assert.strictEqual(extractPartialNameFromLine('= render(@user)'), '_user');
      assert.strictEqual(extractPartialNameFromLine('= render @users'), '_users');
      assert.strictEqual(extractPartialNameFromLine('= render @categories'), '_categories');
    });

    test('prefers an explicit partial over the collection beside it', () => {
      assert.strictEqual(extractPartialNameFromLine("= render partial: 'row', collection: @rows"), '_row');
      assert.strictEqual(extractPartialNameFromLine("= render collection: @rows, partial: 'row'"), '_row');
    });

    test('returns an empty string for lines that only contain the word "render"', () => {
      assert.strictEqual(extractPartialNameFromLine('%p= @rendered_count'), '');
      assert.strictEqual(extractPartialNameFromLine('= render_to_string(@x)'), '');
      assert.strictEqual(extractPartialNameFromLine('= content_for :rendered'), '');
      assert.strictEqual(extractPartialNameFromLine('-# rendered'), '');
      assert.strictEqual(extractPartialNameFromLine(''), '');
    });
  });

  // Signature help calls this on every keystroke; it used to read the file each
  // time.
  suite('fileStringLocals', () => {
    let dir: string;
    let partial: string;

    setup(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'haml-all-locals-'));
      partial = path.join(dir, '_form.html.haml');
      fs.writeFileSync(partial, '-# locals: (user:, title: nil)\n%form');
    });

    teardown(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    test('reads the declared locals', () => {
      assert.strictEqual(fileStringLocals(partial), 'user:, title: nil');
    });

    test('returns an empty string for a partial without the comment', () => {
      const plain = path.join(dir, '_plain.html.haml');
      fs.writeFileSync(plain, '%p Hi');

      assert.strictEqual(fileStringLocals(plain), '');
    });

    test('serves the same mtime from memory, and re-reads after a change', () => {
      // Stamped explicitly: a stat's own mtime carries sub-millisecond precision
      // that utimes cannot restore, which would look like a change.
      const stamp = new Date(Date.now() - 10000);
      fs.utimesSync(partial, stamp, stamp);

      assert.strictEqual(fileStringLocals(partial), 'user:, title: nil');

      // Rewrite keeping the mtime: a cached answer is proof it did not read.
      fs.writeFileSync(partial, '-# locals: (other:)\n');
      fs.utimesSync(partial, stamp, stamp);

      assert.strictEqual(fileStringLocals(partial), 'user:, title: nil');

      const later = new Date(stamp.getTime() + 5000);
      fs.utimesSync(partial, later, later);

      assert.strictEqual(fileStringLocals(partial), 'other:');
    });

    test('returns an empty string for a file that is gone', () => {
      assert.strictEqual(fileStringLocals(path.join(dir, 'missing.haml')), '');
    });
  });
});
