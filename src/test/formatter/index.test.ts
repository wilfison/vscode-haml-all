import * as assert from 'node:assert';

import autoCorrectAll from '../../formatter';
import { HAML_LINT_DEFAULT_COPS } from '../../linter/cops';
import { LinterConfig } from '../../types';

// The legacy formatter only needs `hamlLintConfig` from the Linter.
function fakeLinter(config: LinterConfig) {
  return { hamlLintConfig: config } as any;
}

const ALL_ON: LinterConfig = {
  ...HAML_LINT_DEFAULT_COPS,
  TrailingWhitespace: { enabled: true },
  ClassesBeforeIds: { enabled: true },
  UnnecessaryStringOutput: { enabled: true },
};

suite('formatter/index Tests', () => {
  test('applies only the fixers enabled in the haml-lint config', () => {
    const config = { ...HAML_LINT_DEFAULT_COPS, ClassesBeforeIds: { enabled: true } };

    const result = autoCorrectAll('index.html.haml', '%div#id.class\n%p= "text"', fakeLinter(config));

    assert.strictEqual(result, '%div.class#id\n%p= "text"');
  });

  test('always trims trailing whitespace and blanks whitespace-only lines, even with every cop disabled', () => {
    const result = autoCorrectAll('index.html.haml', '%p  \n   \n%span\t', fakeLinter(HAML_LINT_DEFAULT_COPS));

    assert.strictEqual(result, '%p\n\n%span');
  });

  test('leaves the body of a filter alone (only trims the end of each line)', () => {
    const text = ['%div#id.class', ':javascript', '  var id = "x#id.class"   ', '  a = "y"', '%p#id.class'].join('\n');

    const result = autoCorrectAll('index.html.haml', text, fakeLinter(ALL_ON));

    assert.strictEqual(result, ['%div.class#id', ':javascript', '  var id = "x#id.class"', '  a = "y"', '%p.class#id'].join('\n'));
  });

  test('leaves the filter once a line is indented at or below the filter itself', () => {
    const text = ['%section', '  :css', '    .a { }', '  %p#id.class', '= "out"'].join('\n');

    const result = autoCorrectAll('index.html.haml', text, fakeLinter(ALL_ON));

    assert.strictEqual(result, ['%section', '  :css', '    .a { }', '  %p.class#id', 'out'].join('\n'));
  });

  test('a blank line inside a filter does not end it', () => {
    const text = [':javascript', '  a = 1', '', '  b = "#id.class"', '%p#id.class'].join('\n');

    const result = autoCorrectAll('index.html.haml', text, fakeLinter(ALL_ON));

    assert.strictEqual(result, [':javascript', '  a = 1', '', '  b = "#id.class"', '%p.class#id'].join('\n'));
  });

  test('treats an unknown `:word` line as content, not as a filter', () => {
    const text = [':notafilter', '  %p#id.class'].join('\n');

    const result = autoCorrectAll('index.html.haml', text, fakeLinter(ALL_ON));

    assert.strictEqual(result, [':notafilter', '  %p.class#id'].join('\n'));
  });

  test('runs the whole-file fixers (StrictLocals, FinalNewline) after the line fixers', () => {
    const config = { ...ALL_ON, FinalNewline: { enabled: true }, StrictLocals: { ...ALL_ON.StrictLocals, enabled: true } };

    const result = autoCorrectAll('_row.html.haml', '%p#id.class  ', fakeLinter(config));

    assert.strictEqual(result, '-# locals: ()\n\n%p.class#id\n');
  });
});
