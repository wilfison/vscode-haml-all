import * as assert from 'node:assert';

import hamlFixes from '../../formatter/haml_lint_cops';
import { LinterConfig } from '../../types';

const DEFAULT_HAML_LINT_CONFIG: LinterConfig = {
  RuboCop: {
    enabled: false,
    ignored_cops: [],
  },
  ClassesBeforeIds: {
    enabled: true,
  },
  FinalNewline: {
    enabled: true,
  },
  HtmlAttributes: {
    enabled: true,
  },
  LeadingCommentSpace: {
    enabled: true,
  },
  SpaceBeforeScript: {
    enabled: true,
  },
  TrailingEmptyLines: {
    enabled: true,
  },
  TrailingWhitespace: {
    enabled: true,
  },
  UnnecessaryStringOutput: {
    enabled: true,
  },
};

suite('Haml-Lint Cops', () => {
  suite('fixClassesBeforeIds', () => {
    test('should fix classes before ids', () => {
      const config = DEFAULT_HAML_LINT_CONFIG;

      const text = '%div#id.class\n#id.class';
      const expected = '%div.class#id\n.class#id';
      const result = hamlFixes.fixClassBeforeId(text, config);

      assert.strictEqual(result, expected);
    });

    test('should not fix classes before ids when disabled', () => {
      const config = {
        ...DEFAULT_HAML_LINT_CONFIG,
        ClassesBeforeIds: {
          enabled: false,
        },
      } as LinterConfig;

      const text = '%div#id.class\n#id.class';
      const expected = text;
      const result = hamlFixes.fixClassBeforeId(text, config);

      assert.strictEqual(result, expected);
    });
  });

  suite('TrailingWhitespace', () => {
    test('should remove trailing whitespace to the right of the text', () => {
      const config = DEFAULT_HAML_LINT_CONFIG;

      const text = '%div  \n  %div \n';
      const expected = '%div\n  %div\n';
      const result = hamlFixes.fixTrailingWhitespace(text, config);

      assert.strictEqual(result, expected);
    });

    test('should not remove trailing whitespace when disabled', () => {
      const config = {
        ...DEFAULT_HAML_LINT_CONFIG,
        TrailingWhitespace: {
          enabled: false,
        },
      } as LinterConfig;

      const text = '%div  \n  %div \n';
      const expected = text;
      const result = hamlFixes.fixTrailingWhitespace(text, config);

      assert.strictEqual(result, expected);
    });
  });

  suite('FinalNewline', () => {
    test('should add a blank line at the end if not present', () => {
      const config = DEFAULT_HAML_LINT_CONFIG;

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
      const config = {
        ...DEFAULT_HAML_LINT_CONFIG,
        FinalNewline: {
          enabled: false,
        },
      } as LinterConfig;

      const text = '%div';
      const expected = text;
      const result = hamlFixes.fixFinalNewline(text, config);

      assert.strictEqual(result, expected);
    });
  });

  suite('HtmlAttributes', () => {
    test('should convert HTML attributes to HAML Hash attributes', () => {
      const config = DEFAULT_HAML_LINT_CONFIG;

      const text = '%div(foo="bar" baz="qux#{quux}")';
      const expected = '%div{foo: "bar", baz: "qux#{quux}"}';
      const result = hamlFixes.fixHtmlAttributes(text, config);

      assert.strictEqual(result, expected);
    });
  });

  suite('TrailingEmptyLines', () => {
    test('should remove trailing empty lines', () => {
      const config = DEFAULT_HAML_LINT_CONFIG;

      const text = '%div\n\n\n';
      const expected = '%div\n\n';
      const result = hamlFixes.fixTrailingEmptyLines(text, config);

      assert.strictEqual(result, expected);
    });

    test('should not remove trailing empty lines when disabled', () => {
      const config = {
        ...DEFAULT_HAML_LINT_CONFIG,
        TrailingEmptyLines: {
          enabled: false,
        },
      } as LinterConfig;

      const text = '%div\n\n\n';
      const expected = text;
      const result = hamlFixes.fixTrailingEmptyLines(text, config);

      assert.strictEqual(result, expected);
    });
  });

  suite('fixSpaceBeforeScript', () => {
    test('should add a space before Ruby script indicators (-/=)', () => {
      const config = DEFAULT_HAML_LINT_CONFIG;

      const text = '-foo\n=bar';
      const expected = '- foo\n= bar';
      const result = hamlFixes.fixSpaceBeforeScript(text, config);

      assert.strictEqual(result, expected);
    });

    test('should not add a space before Ruby script indicators (-/=) when disabled', () => {
      const config = {
        ...DEFAULT_HAML_LINT_CONFIG,
        SpaceBeforeScript: {
          enabled: false,
        },
      } as LinterConfig;

      const text = '-foo\n=bar';
      const expected = text;
      const result = hamlFixes.fixSpaceBeforeScript(text, config);

      assert.strictEqual(result, expected);
    });
  });

  suite('fixLeadingCommentSpace', () => {
    test('should add a space after the leading comment indicator (-#)', () => {
      const config = DEFAULT_HAML_LINT_CONFIG;

      const text = '-#foo';
      const expected = '-# foo';
      const result = hamlFixes.fixLeadingCommentSpace(text, config);

      assert.strictEqual(result, expected);
    });

    test('should not add a space after the leading comment indicator (-#) when disabled', () => {
      const config = {
        ...DEFAULT_HAML_LINT_CONFIG,
        LeadingCommentSpace: {
          enabled: false,
        },
      } as LinterConfig;

      const text = '-#foo';
      const expected = text;
      const result = hamlFixes.fixLeadingCommentSpace(text, config);

      assert.strictEqual(result, expected);
    });
  });

  suite('fixUnnecessaryStringOutput', () => {
    test('should remove unnecessary string output indicators', () => {
      const config = DEFAULT_HAML_LINT_CONFIG;

      const text = '= "foo"';
      const expected = 'foo';
      const result = hamlFixes.fixUnnecessaryStringOutput(text, config);

      assert.strictEqual(result, expected);
    });

    test('should not remove unnecessary string output indicators when disabled', () => {
      const config = {
        ...DEFAULT_HAML_LINT_CONFIG,
        UnnecessaryStringOutput: {
          enabled: false,
        },
      } as LinterConfig;

      const text = '= "foo"';
      const expected = text;
      const result = hamlFixes.fixUnnecessaryStringOutput(text, config);

      assert.strictEqual(result, expected);
    });
  });
});