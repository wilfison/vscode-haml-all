import * as assert from 'assert';

import { assetPathInvalidatesIndex } from '../../rails/assetIndex';

suite('rails/assetIndex Tests', () => {
  suite('assetPathInvalidatesIndex', () => {
    test('invalidates for source assets', () => {
      assert.strictEqual(assetPathInvalidatesIndex('public/images/logo.png'), true);
      assert.strictEqual(assetPathInvalidatesIndex('app/assets/images/a.png'), true);
      assert.strictEqual(assetPathInvalidatesIndex('app/javascript/images/b.svg'), true);
      assert.strictEqual(assetPathInvalidatesIndex('vendor/assets/images/c.png'), true);
    });

    test('ignores build output under public/', () => {
      assert.strictEqual(assetPathInvalidatesIndex('public/assets/application-abc123.js'), false);
      assert.strictEqual(assetPathInvalidatesIndex('public/packs/js/x.js'), false);
      assert.strictEqual(assetPathInvalidatesIndex('public/packs-test/js/x.js'), false);
      assert.strictEqual(assetPathInvalidatesIndex('public/builds/x.css'), false);
      assert.strictEqual(assetPathInvalidatesIndex('public/vite/x.js'), false);
    });
  });
});
