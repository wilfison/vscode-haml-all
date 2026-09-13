import * as assert from 'assert';

import { isPathCommand, splitCommand } from '../../utils/command';

suite('utils/command Tests', () => {
  test('splitCommand turns a configured command into argv, collapsing extra whitespace', () => {
    assert.deepStrictEqual(splitCommand('  bundle   exec rails '), ['bundle', 'exec', 'rails']);
    assert.deepStrictEqual(splitCommand(''), []);
  });

  test('isPathCommand distinguishes a path from a bare name looked up in PATH', () => {
    assert.strictEqual(isPathCommand('rails'), false);
    assert.strictEqual(isPathCommand('bin/rails'), true);
    assert.strictEqual(isPathCommand('bin\\rails'), true);
    assert.strictEqual(isPathCommand('/usr/bin/rails'), true);
  });
});
