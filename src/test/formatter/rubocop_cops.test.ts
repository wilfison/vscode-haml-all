import * as assert from 'node:assert';

import rubocopFixes from '../../formatter/rubocop_cops';
import { RuboCopConfig } from '../../types';

const DEFAULT_RUBOCOP_CONFIG: RuboCopConfig = {
  'Layout/SpaceBeforeComma': {
    Enabled: true,
  },
  'Style/StringLiterals': {
    Enabled: true,
    EnforcedStyle: 'double_quotes',
  },
  'Layout/SpaceAfterColon': {
    Enabled: true,
  },
  'Layout/SpaceInsideParens': {
    Enabled: true,
    EnforcedStyle: 'space',
  },
  'Style/MethodCallWithArgsParentheses': {
    Enabled: true,
    EnforcedStyle: 'require_parentheses',
  },
};

suite('RuboCop Cops', () => {
  suite('fixStringLiterals', () => {
    test('should convert single quotes to double quotes when EnforcedStyle is double_quotes', () => {
      const config = DEFAULT_RUBOCOP_CONFIG;

      const text = '= render(\'form\', locals: { user: user, title: \'No "update" this content\'  })';
      const expected = '= render("form", locals: { user: user, title: \'No "update" this content\'  })';
      const result = rubocopFixes.fixStringLiterals(text, config);

      assert.strictEqual(result, expected);
    });

    test('should convert double quotes to single quotes when EnforcedStyle is single_quotes', () => {
      const config = {
        ...DEFAULT_RUBOCOP_CONFIG,
        'Style/StringLiterals': {
          Enabled: true,
          EnforcedStyle: 'single_quotes',
        },
      } as RuboCopConfig;

      const text = '= render("form", locals: { user: user, title: "No \'update\' this content"  })';
      const expected = '= render(\'form\', locals: { user: user, title: "No \'update\' this content"  })';
      const result = rubocopFixes.fixStringLiterals(text, config);

      assert.strictEqual(result, expected);
    });
  });

  suite('fixSpaceInsideParens', () => {
    test('should add spaces inside parentheses when EnforcedStyle is space', () => {
      const config = DEFAULT_RUBOCOP_CONFIG;

      const text = [
        '= render(foo: "bar")',
        '= render( foo: "bar")',
        '= render(foo: "bar" )',
        '= render( foo: "bar" )'
      ];

      const expected = [
        '= render( foo: "bar" )',
        '= render( foo: "bar" )',
        '= render( foo: "bar" )',
        '= render( foo: "bar" )'
      ];

      const result = text.map((t) => rubocopFixes.fixSpaceInsideParens(t, config));
      assert.deepStrictEqual(result, expected);

      const text2 = '-# locals: (q:)';
      const expected2 = '-# locals: ( q: )';
      const result2 = rubocopFixes.fixSpaceInsideParens(text2, config);
      assert.strictEqual(result2, expected2);
    });

    test('should remove spaces inside parentheses when EnforcedStyle is no_space', () => {
      const config = {
        ...DEFAULT_RUBOCOP_CONFIG,
        'Layout/SpaceInsideParens': {
          Enabled: true,
          EnforcedStyle: 'no_space',
        },
      } as RuboCopConfig;

      const text = [
        '= render(foo: "bar")',
        '= render( foo: "bar")',
        '= render(foo: "bar" )',
        '= render( foo: "bar" )'
      ];

      const expected = [
        '= render(foo: "bar")',
        '= render(foo: "bar")',
        '= render(foo: "bar")',
        '= render(foo: "bar")'
      ];

      const result = text.map((t) => rubocopFixes.fixSpaceInsideParens(t, config));
      assert.deepStrictEqual(result, expected);
    });
  });

  suite('fixSpaceBeforeComma', () => {
    test('should add space before comma', () => {
      const config = DEFAULT_RUBOCOP_CONFIG;

      const text = 'foo , bar ,baz\n= foo(bar: 1 , baz: "abc , 123" , "def" => 456)';
      const expected = 'foo, bar,baz\n= foo(bar: 1, baz: "abc , 123", "def" => 456)';
      const result = rubocopFixes.fixSpaceBeforeComma(text, config);

      assert.strictEqual(result, expected);
    });
  });

  suite('fixSpaceAfterColon', () => {
    test('should add space after colon', () => {
      const config = DEFAULT_RUBOCOP_CONFIG;

      const text = [
        'foo:bar',
        '= foo(bar:1, class:"abc:123 cde:456")',
        '- foo(bar:1,class:"abc:123 cde:456")',
        '= link_to(\'some link\', \'https://hahah.com\')'
      ];

      const expected = [
        'foo:bar',
        '= foo(bar: 1, class: "abc:123 cde:456")',
        '- foo(bar: 1,class: "abc:123 cde:456")',
        '= link_to(\'some link\', \'https://hahah.com\')'
      ];

      const result = text.map((t) => rubocopFixes.fixSpaceAfterColon(t, config));
      assert.deepStrictEqual(result, expected);
    });
  });

  suite('fixMethodCallWithArgsParentheses', () => {
    test('should add parentheses to method call arguments', () => {
      const config = DEFAULT_RUBOCOP_CONFIG;

      const text = [
        '= foo bar: 1, baz: "abc"',
        '= foo bar: 1, baz: "abc" || \'ABC\'',
        '- f.bar 1, "abc"',
        '- foo bar: 1, baz: "abc" do |x|',
        '- if foo? bar',
        '= foo bar if foo? bar'
      ];

      const expected = [
        '= foo(bar: 1, baz: "abc")',
        '= foo bar: 1, baz: "abc" || \'ABC\'',
        '- f.bar(1, "abc")',
        '- foo(bar: 1, baz: "abc") do |x|',
        '- if foo? bar',
        '= foo(bar) if foo? bar'
      ];

      const result = text.map((t) => rubocopFixes.fixMethodCallWithArgsParentheses(t, config));
      assert.deepStrictEqual(result, expected);
    });

    test('should not add parentheses to method call arguments if not a method call with args', () => {
      const config = DEFAULT_RUBOCOP_CONFIG;

      const text = [
        '- foo ? bar : baz',
        '- foo = bar ? baz : qux'
      ];

      const expected = [
        '- foo ? bar : baz',
        '- foo = bar ? baz : qux'
      ];

      const result = text.map((t) => rubocopFixes.fixMethodCallWithArgsParentheses(t, config));
      assert.deepStrictEqual(result, expected);
    });
  });
});
