import * as assert from 'node:assert';

import hamlFixes from '../../formatter/haml_lint_cops';
import { HAML_LINT_DEFAULT_COPS } from '../../linter/cops';

suite('Haml-Lint Cops', () => {
  suite('fixClassesBeforeIds', () => {
    test('should fix classes before ids', () => {
      const config = { ...HAML_LINT_DEFAULT_COPS, ClassesBeforeIds: { enabled: true } };

      const text = '%div#id.class\n#id.class';
      const expected = '%div.class#id\n.class#id';
      const result = hamlFixes.fixClassBeforeId(text, config);

      assert.strictEqual(result, expected);
    });

    test('should not fix classes before ids when disabled', () => {
      const config = HAML_LINT_DEFAULT_COPS;

      const text = '%div#id.class\n#id.class';
      const expected = text;
      const result = hamlFixes.fixClassBeforeId(text, config);

      assert.strictEqual(result, expected);
    });
  });

  suite('TrailingWhitespace', () => {
    test('should remove trailing whitespace to the right of the text', () => {
      const config = { ...HAML_LINT_DEFAULT_COPS, TrailingWhitespace: { enabled: true } };

      const text = '%div  \n';
      const expected = '%div';
      const result = hamlFixes.fixTrailingWhitespace(text, config);

      assert.strictEqual(result, expected);
    });

    test('should not remove trailing whitespace when disabled', () => {
      const config = HAML_LINT_DEFAULT_COPS;

      const text = '%div  \n  %div \n';
      const expected = text;
      const result = hamlFixes.fixTrailingWhitespace(text, config);

      assert.strictEqual(result, expected);
    });
  });

  suite('FinalNewline', () => {
    test('should add a blank line at the end if not present', () => {
      const config = { ...HAML_LINT_DEFAULT_COPS, FinalNewline: { enabled: true } };

      const text1 = '%div';
      const expected1 = '%div\n';
      const result1 = hamlFixes.fixFinalNewline(text1, config);

      const text2 = '%div\n\n\n';
      const expected2 = '%div\n';
      const result2 = hamlFixes.fixFinalNewline(text2, config);

      assert.strictEqual(result1, expected1);
      assert.strictEqual(result2, expected2);
    });

    test('should not add a blank line at the end if not present when disabled', () => {
      const config = HAML_LINT_DEFAULT_COPS;

      const text = '%div';
      const expected = text;
      const result = hamlFixes.fixFinalNewline(text, config);

      assert.strictEqual(result, expected);
    });
  });

  suite('HtmlAttributes', () => {
    test('should convert HTML attributes to HAML Hash attributes', () => {
      const config = { ...HAML_LINT_DEFAULT_COPS, HtmlAttributes: { enabled: true } };

      const text = '%div(foo="bar" baz="qux#{quux}")';
      const expected = '%div{foo: "bar", baz: "qux#{quux}"}';
      const result = hamlFixes.fixHtmlAttributes(text, config);

      assert.strictEqual(result, expected);
    });
  });

  suite('TrailingEmptyLines', () => {
    test('should remove trailing empty lines', () => {
      const config = { ...HAML_LINT_DEFAULT_COPS, TrailingEmptyLines: { enabled: true } };

      const text = '%div\n\n\n';
      const expected = '%div\n\n';
      const result = hamlFixes.fixTrailingEmptyLines(text, config);

      assert.strictEqual(result, expected);
    });

    test('should not remove trailing empty lines when disabled', () => {
      const config = HAML_LINT_DEFAULT_COPS;

      const text = '%div\n\n\n';
      const expected = text;
      const result = hamlFixes.fixTrailingEmptyLines(text, config);

      assert.strictEqual(result, expected);
    });
  });

  suite('SpaceBeforeScript', () => {
    test('should add a space before Ruby script indicators (-/=)', () => {
      const config = { ...HAML_LINT_DEFAULT_COPS, SpaceBeforeScript: { enabled: true } };

      const text = ['-foo', '=bar', '- foo'];
      const expected = ['- foo', '= bar', '- foo'];

      const result = text.map((t) => hamlFixes.fixSpaceBeforeScript(t, config));
      assert.deepStrictEqual(result, expected);
    });

    test('should not add a space before Ruby script indicators (-/=) when disabled', () => {
      const config = HAML_LINT_DEFAULT_COPS;

      const text = '-foo\n=bar';
      const expected = text;
      const result = hamlFixes.fixSpaceBeforeScript(text, config);

      assert.strictEqual(result, expected);
    });
  });

  suite('LeadingCommentSpace', () => {
    test('should add a space after the leading comment indicator (-#)', () => {
      const config = { ...HAML_LINT_DEFAULT_COPS, LeadingCommentSpace: { enabled: true } };

      const text = '-#foo';
      const expected = '-# foo';
      const result = hamlFixes.fixLeadingCommentSpace(text, config);

      assert.strictEqual(result, expected);
    });

    test('should not add a space after the leading comment indicator (-#) when disabled', () => {
      const config = HAML_LINT_DEFAULT_COPS;

      const text = '-#foo';
      const expected = text;
      const result = hamlFixes.fixLeadingCommentSpace(text, config);

      assert.strictEqual(result, expected);
    });
  });

  suite('UnnecessaryStringOutput', () => {
    test('should remove unnecessary string output indicators', () => {
      const config = { ...HAML_LINT_DEFAULT_COPS, UnnecessaryStringOutput: { enabled: true } };

      const text = '= "foo"';
      const expected = 'foo';
      const result = hamlFixes.fixUnnecessaryStringOutput(text, config);

      assert.strictEqual(result, expected);
    });

    test('should not remove unnecessary string output indicators when disabled', () => {
      const config = HAML_LINT_DEFAULT_COPS;

      const text = '= "foo"';
      const expected = text;
      const result = hamlFixes.fixUnnecessaryStringOutput(text, config);

      assert.strictEqual(result, expected);
    });
  });

  suite('StrictLocals', () => {
    test('should add "locals" comment in the top of the file', () => {
      const config = {
        ...HAML_LINT_DEFAULT_COPS,
        StrictLocals: {
          ...HAML_LINT_DEFAULT_COPS.StrictLocals,
          enabled: true
        }
      };

      const text = '- foo = bar';
      const expected = '-# locals: ()\n\n- foo = bar';
      const result = hamlFixes.fixStrictLocals('_partial.html.haml', text, config);

      assert.strictEqual(result, expected);
    });

    test('should not add "locals" comment in the top of the file when disabled', () => {
      const config = HAML_LINT_DEFAULT_COPS;

      const text = '- foo = bar';
      const expected = text;
      const result = hamlFixes.fixStrictLocals('_partial.html.haml', text, config);

      assert.strictEqual(result, expected);
    });

    test('should not add "locals" comment in the top of the file when already present', () => {
      const config = HAML_LINT_DEFAULT_COPS;
      config.StrictLocals.enabled = true;

      const text = '-# locals: foo';
      const expected = text;
      const result = hamlFixes.fixStrictLocals('_partial.html.haml', text, config);

      assert.strictEqual(result, expected);
    });

    test('should not add "locals" comment in the top of the file when not a partial', () => {
      const config = HAML_LINT_DEFAULT_COPS;
      config.StrictLocals.enabled = true;

      const text = '- foo = bar';
      const expected = text;
      const result = hamlFixes.fixStrictLocals('file.html.haml', text, config);

      assert.strictEqual(result, expected);
    });
  });
});
