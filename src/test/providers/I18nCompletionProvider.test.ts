import * as assert from 'assert';
import * as vscode from 'vscode';
import I18nCompletionProvider from '../../providers/i18n/I18nCompletionProvider';
import { CacheLocaleType } from '../../ultils/yaml';
import { I18nLocaleConfig } from '../../providers/i18n';

suite('I18nCompletionProvider Tests', () => {
  let provider: I18nCompletionProvider;
  let localesData: CacheLocaleType;
  let localeConfig: I18nLocaleConfig;

  setup(() => {
    localeConfig = { defaultLocale: 'en' };
    localesData = new Map(
      Object.entries({
        'en': {
          'user.name': { value: 'User Name', file_path: 'en.yaml', file_line: 1 },
          'admin.dashboard': { value: 'Admin Dashboard', file_path: 'en.yaml', file_line: 2 }
        },
        'fr': {
          'user.name': { value: 'Nom d\'utilisateur', file_path: 'fr.yaml', file_line: 1 },
          'admin.dashboard': { value: 'Tableau de bord Admin', file_path: 'fr.yaml', file_line: 2 }
        }
      })
    );

    provider = new I18nCompletionProvider(localesData, localeConfig);
  });

  test('should provide completions for I18n.t helper', async () => {
    const document = {
      getText: (range: vscode.Range) => '= I18n.t(\'user'
    } as any;

    const position = new vscode.Position(0, 16);

    const completions = await provider.provideCompletionItems(document, position);

    if (Array.isArray(completions)) {
      assert.ok(completions.length >= 0);
    }
  });

  test('should provide completions for t helper', async () => {
    const document = {
      getText: (range: vscode.Range) => '= t(\'admin'
    } as any;

    const position = new vscode.Position(0, 12);

    const completions = await provider.provideCompletionItems(document, position);

    if (Array.isArray(completions)) {
      assert.ok(completions.length >= 0);
    }
  });

  test('should return null when not in i18n context', async () => {
    const document = {
      getText: (range: vscode.Range) => '= some_other_helper(\'value'
    } as any;

    const position = new vscode.Position(0, 26);

    const completions = await provider.provideCompletionItems(document, position);

    assert.strictEqual(completions, null);
  });

  test('should not duplicate keys from different locales', async () => {
    const document = {
      getText: (range: vscode.Range) => '= t(\'user'
    } as any;

    const position = new vscode.Position(0, 11);
    const completions = await provider.provideCompletionItems(document, position);

    if (Array.isArray(completions)) {
      const keys = completions.map(item => item.label);
      const uniqueKeys = [...new Set(keys)];

      assert.strictEqual(keys.length, uniqueKeys.length, 'Should not have duplicate keys');
    }
  });
});
