import * as assert from 'node:assert';

import rubocopFixes from '../../formatter/rubocop_cops';
import { RuboCopConfig } from '../../types';

const DEFAULT_RUBOCOP_CONFIG: RuboCopConfig = {
  'Style/StringLiterals': {
    Enabled: true,
    EnforcedStyle: 'double_quotes',
  },
  'Layout/SpaceInsideParens': {
    Enabled: true,
    EnforcedStyle: 'space',
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

      const text = '= render(foo: "bar")\n= render( foo: "bar")\n= render(foo: "bar" )\n= render( foo: "bar" )';
      const expected = '= render( foo: "bar" )\n= render( foo: "bar" )\n= render( foo: "bar" )\n= render( foo: "bar" )';
      const result = rubocopFixes.fixSpaceInsideParens(text, config);

      assert.strictEqual(result, expected);
    });

    test('should remove spaces inside parentheses when EnforcedStyle is no_space', () => {
      const config = {
        ...DEFAULT_RUBOCOP_CONFIG,
        'Layout/SpaceInsideParens': {
          Enabled: true,
          EnforcedStyle: 'no_space',
        },
      } as RuboCopConfig;

      const text = '= render(foo: "bar")\n= render( foo: "bar")\n= render(foo: "bar" )\n= render( foo: "bar" )';
      const expected = '= render(foo: "bar")\n= render(foo: "bar")\n= render(foo: "bar")\n= render(foo: "bar")';
      const result = rubocopFixes.fixSpaceInsideParens(text, config);

      assert.strictEqual(result, expected);
    });
  });
});
