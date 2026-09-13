import * as assert from 'assert';

import { PartialFile, partialFileFrom, partialPathInvalidatesIndex, resolvePartial } from '../../rails/partialIndex';

const ROOT = '/w/app/views';
const ENGINE = '/w/engines/blog/app/views';

// Builds the index from paths, the way a workspace scan would.
function indexOf(...paths: string[]): PartialFile[] {
  return paths.map((absolutePath) => partialFileFrom(absolutePath) as PartialFile);
}

const INDEX = indexOf(
  `${ROOT}/users/_row.html.haml`,
  `${ROOT}/users/_row.turbo_stream.haml`,
  `${ROOT}/users/_user.html.haml`,
  `${ROOT}/shared/_header.html.haml`,
  `${ROOT}/shared/_header.html.erb`,
  `${ROOT}/posts/_row.html.haml`,
  `${ENGINE}/shared/_header.html.haml`
);

suite('rails/partialIndex Tests', () => {
  suite('partialFileFrom', () => {
    test('splits a template into directory, base name and variant', () => {
      const partial = partialFileFrom('/w/app/views/users/_row.html.haml') as PartialFile;

      assert.strictEqual(partial.viewsRoot, '/w/app/views');
      assert.strictEqual(partial.dir, 'users');
      assert.strictEqual(partial.baseName, '_row');
      assert.strictEqual(partial.variant, 'html.haml');
      assert.strictEqual(partial.logicalPath, 'users/_row');
    });

    test('keeps a device variant out of the base name', () => {
      const partial = partialFileFrom('/w/app/views/users/_row+mobile.html.haml') as PartialFile;

      assert.strictEqual(partial.baseName, '_row');
      assert.strictEqual(partial.variant, '+mobile.html.haml');
      assert.strictEqual(partial.logicalPath, 'users/_row');
    });

    test('handles a partial at the root of app/views', () => {
      const partial = partialFileFrom('/w/app/views/_flash.html.haml') as PartialFile;

      assert.strictEqual(partial.dir, '');
      assert.strictEqual(partial.logicalPath, '_flash');
    });

    test('rejects a path outside app/views', () => {
      assert.strictEqual(partialFileFrom('/w/app/components/_button.html.haml'), null);
    });
  });

  suite('resolvePartial', () => {
    const from = (partialName: string, currentView = `${ROOT}/users/index.html.haml`) =>
      resolvePartial(INDEX, partialName, currentView);

    test('resolves a name carrying a directory', () => {
      assert.deepStrictEqual(from('shared/_header'), [`${ROOT}/shared/_header.html.haml`, `${ROOT}/shared/_header.html.erb`]);
    });

    test('resolves a bare name next to the current view, and returns its variants', () => {
      assert.deepStrictEqual(from('_row'), [`${ROOT}/users/_row.html.haml`, `${ROOT}/users/_row.turbo_stream.haml`]);
    });

    test('falls back to another directory for a bare name with no local match', () => {
      assert.deepStrictEqual(from('_user', `${ROOT}/posts/show.html.haml`), [`${ROOT}/users/_user.html.haml`]);
    });

    test('prefers the partial of the app the current file belongs to', () => {
      assert.deepStrictEqual(from('shared/_header', `${ENGINE}/posts/index.html.haml`), [`${ENGINE}/shared/_header.html.haml`]);
    });

    test('prefers the nearest directory when several match a bare name', () => {
      assert.deepStrictEqual(from('_row', `${ROOT}/posts/index.html.haml`), [`${ROOT}/posts/_row.html.haml`]);
    });

    test('singularizes a collection name that matches nothing', () => {
      assert.deepStrictEqual(from('_users'), [`${ROOT}/users/_user.html.haml`]);
      assert.deepStrictEqual(
        resolvePartial(indexOf(`${ROOT}/categories/_category.html.haml`), '_categories', `${ROOT}/posts/index.html.haml`),
        [`${ROOT}/categories/_category.html.haml`]
      );
    });

    test('prefers an exact match over the singular', () => {
      const index = indexOf(`${ROOT}/users/_users.html.haml`, `${ROOT}/users/_user.html.haml`);

      assert.deepStrictEqual(resolvePartial(index, '_users', `${ROOT}/users/index.html.haml`), [
        `${ROOT}/users/_users.html.haml`,
      ]);
    });

    test('returns nothing for an unknown partial or an empty name', () => {
      assert.deepStrictEqual(from('_nope'), []);
      assert.deepStrictEqual(from('shared/_nope'), []);
      assert.deepStrictEqual(from(''), []);
    });

    test('resolves from a file outside app/views', () => {
      assert.deepStrictEqual(resolvePartial(INDEX, 'shared/_header', '/w/app/mailers/user_mailer.rb'), [
        `${ROOT}/shared/_header.html.haml`,
        `${ROOT}/shared/_header.html.erb`,
      ]);
    });
  });

  suite('partialPathInvalidatesIndex', () => {
    test('reacts to files under app/views only', () => {
      assert.strictEqual(partialPathInvalidatesIndex('app/views/users/_row.html.haml'), true);
      assert.strictEqual(partialPathInvalidatesIndex('engines/blog/app/views/_x.haml'), true);
      assert.strictEqual(partialPathInvalidatesIndex('app/models/user.rb'), false);
    });
  });
});
