import * as assert from 'assert';
import * as vscode from 'vscode';
import I18nDiagnosticsProvider from '../../../providers/i18n/I18nDiagnosticsProvider';
import { CacheLocaleType } from '../../../ultils/yaml';

suite('I18nDiagnosticsProvider Configuration Tests', () => {
  let provider: I18nDiagnosticsProvider;
  let mockDocument: vscode.TextDocument;
  let localesData: CacheLocaleType;

  setup(() => {
    localesData = new Map();
    localesData.set('en', {
      'hello.world': {
        value: 'Hello World',
        file_path: '/test/locales/en.yml',
        file_line: 1
      }
    });
    provider = new I18nDiagnosticsProvider(localesData);

    // Mock document
    mockDocument = {
      languageId: 'haml',
      getText: () => '= t("hello.world")\n= t("missing.key")',
      positionAt: (offset: number) => new vscode.Position(0, offset),
      uri: vscode.Uri.file('/test/file.haml')
    } as any;
  });

  teardown(() => {
    provider.dispose();
  });

  test('should respect i18nValidation.enabled configuration', async () => {
    // Mock configuration to return false
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = (section?: string) => ({
      get: (key: string, defaultValue?: any) => {
        if (key === 'i18nValidation.enabled') {
          return false;
        }
        return defaultValue;
      }
    } as any);

    await provider.validateDocument(mockDocument);

    // Should not have any diagnostics when disabled
    const diagnostics = provider.diagnosticCollection.get(mockDocument.uri);
    assert.strictEqual(diagnostics?.length || 0, 0, 'Should not create diagnostics when validation is disabled');

    // Restore original configuration
    vscode.workspace.getConfiguration = originalGetConfiguration;
  });

  test('should validate normally when i18nValidation.enabled is true', async () => {
    // Mock configuration to return true
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = (section?: string) => ({
      get: (key: string, defaultValue?: any) => {
        if (key === 'i18nValidation.enabled') {
          return true;
        }
        return defaultValue;
      }
    } as any);

    await provider.validateDocument(mockDocument);

    // Should have diagnostics for missing key when enabled
    const diagnostics = provider.diagnosticCollection.get(mockDocument.uri);
    assert.ok(diagnostics && diagnostics.length > 0, 'Should create diagnostics when validation is enabled');

    // Check that it found the missing key
    const missingKeyDiagnostic = diagnostics?.find(d => d.message.includes('missing.key'));
    assert.ok(missingKeyDiagnostic, 'Should report missing.key as an error');

    // Restore original configuration
    vscode.workspace.getConfiguration = originalGetConfiguration;
  });
});
