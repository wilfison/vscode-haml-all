import * as assert from 'assert';
import * as path from 'node:path';

import ViewCompletionProvider, { matchScore } from '../../providers/ViewCompletionProvider';
import { toPosix } from '../../utils/file';

suite('ViewCompletionProvider Tests', () => {
  suite('matchScore', () => {
    test('scores shared directory segments, ignoring the file name', () => {
      assert.strictEqual(matchScore('users/index.haml', 'users/_row.haml'), 1);
      assert.strictEqual(matchScore('admin/users/index.haml', 'admin/users/_row.haml'), 2);
      assert.strictEqual(matchScore('users/index.haml', 'posts/_row.haml'), 0);
    });
  });

  suite('buildCompletionItem', () => {
    const provider = new ViewCompletionProvider();

    test('builds the same partial path from a native and a POSIX view path', () => {
      const native = toPosix(['users', '_row.html.haml'].join(path.sep));
      const current = toPosix(['users', 'index.html.haml'].join(path.sep));

      const fromNative = provider.buildCompletionItem(native, current);
      const fromPosix = provider.buildCompletionItem('users/_row.html.haml', 'users/index.html.haml');

      assert.strictEqual(fromNative.label, fromPosix.label);
      assert.strictEqual(fromNative.label, 'row');
    });

    test('keeps the directory prefix for a partial outside the current view folder', () => {
      const item = provider.buildCompletionItem('shared/_header.html.haml', 'users/index.html.haml');

      assert.strictEqual(item.label, 'shared/header');
    });
  });
});
