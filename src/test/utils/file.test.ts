import * as assert from 'assert';

import { extractPartialNameFromLine } from '../../utils/file';

suite('utils/file Tests', () => {
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
