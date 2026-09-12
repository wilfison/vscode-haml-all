import * as assert from 'assert';

import { newFilePath } from '../html2Haml';

suite('html2Haml Tests', () => {
  suite('newFilePath', () => {
    test('converts every supported extension to .haml', () => {
      assert.strictEqual(newFilePath('/ws/app/views/users/index.html.erb').path, '/ws/app/views/users/index.html.haml');
      assert.strictEqual(newFilePath('/ws/app/views/users/index.erb').path, '/ws/app/views/users/index.haml');
      assert.strictEqual(newFilePath('/ws/page.html').path, '/ws/page.haml');
      assert.strictEqual(newFilePath('/ws/page.htm').path, '/ws/page.haml');
    });

    test('leaves an unrelated extension alone', () => {
      assert.strictEqual(newFilePath('/ws/page.haml').path, '/ws/page.haml');
    });
  });
});
