import * as assert from 'assert';
import * as vscode from 'vscode';
import I18nDiagnosticsProvider from '../../../providers/i18n/I18nDiagnosticsProvider';
import { CacheLocaleType } from '../../../ultils/yaml';

suite('I18nDiagnosticsProvider Tests', () => {
  let provider: I18nDiagnosticsProvider;
  let localesData: CacheLocaleType;

  setup(() => {
    localesData = new Map();

    localesData.set('en', {
      'user.name': { value: 'User Name', file_path: 'en.yaml', file_line: 1 },
      'user.email': { value: 'Email', file_path: 'en.yaml', file_line: 2 },
      'admin.dashboard': { value: 'Admin Dashboard', file_path: 'en.yaml', file_line: 3 },
      'messages.success': { value: 'Success!', file_path: 'en.yaml', file_line: 4 },
      'messages.error': { value: 'Error!', file_path: 'en.yaml', file_line: 5 }
    });

    localesData.set('pt', {
      'user.name': { value: 'Nome do Usuário', file_path: 'pt.yaml', file_line: 1 },
      'user.email': { value: 'E-mail', file_path: 'pt.yaml', file_line: 2 },
      'admin.dashboard': { value: 'Painel Admin', file_path: 'pt.yaml', file_line: 3 }
    });

    provider = new I18nDiagnosticsProvider(localesData);
  });

  teardown(() => {
    provider.dispose();
  });

  test('should not create diagnostics for valid I18n.t keys', async () => {
    const document = createMockDocument('haml',
      '= I18n.t(\'user.name\')\n' +
      '= I18n.t(\'admin.dashboard\')\n' +
      '= I18n.t(\'messages.success\')' +
      '= I18n.t("user.enum.#{interpolation}")'
    );

    await provider.validateDocument(document);

    const diagnostics = provider.diagnosticCollection.get(document.uri);
    assert.strictEqual(diagnostics?.length, 0, 'Should not create diagnostics for valid keys');
  });

  test('should not create diagnostics for valid t helper keys', async () => {
    const document = createMockDocument('haml',
      '= t(\'user.email\')\n' +
      '- content = t(\'messages.error\')\n' +
      '%span= t(\'admin.dashboard\')'
    );

    await provider.validateDocument(document);

    const diagnostics = provider.diagnosticCollection.get(document.uri);
    assert.strictEqual(diagnostics?.length, 0, 'Should not create diagnostics for valid keys');
  });

  test('should create diagnostics for invalid I18n keys', async () => {
    const document = createMockDocument('haml',
      '= I18n.t(\'user.invalid_key\')\n' +
      '= I18n.t(\'nonexistent.key\')'
    );

    await provider.validateDocument(document);

    const diagnostics = provider.diagnosticCollection.get(document.uri);
    assert.strictEqual(diagnostics?.length, 2, 'Should create diagnostics for 2 invalid keys');

    const firstDiagnostic = diagnostics![0];
    assert.strictEqual(firstDiagnostic.message, 'I18n key \'user.invalid_key\' not found in locale files');
    assert.strictEqual(firstDiagnostic.severity, vscode.DiagnosticSeverity.Error);
    assert.strictEqual(firstDiagnostic.source, 'i18n-validator');

    const secondDiagnostic = diagnostics![1];
    assert.strictEqual(secondDiagnostic.message, 'I18n key \'nonexistent.key\' not found in locale files');
    assert.strictEqual(secondDiagnostic.severity, vscode.DiagnosticSeverity.Error);
  });

  test('should create diagnostics for invalid t helper keys', async () => {
    const document = createMockDocument('haml',
      '= t(\'invalid.key\')\n' +
      '- content = t(\'another.invalid\')'
    );

    await provider.validateDocument(document);

    const diagnostics = provider.diagnosticCollection.get(document.uri);
    assert.strictEqual(diagnostics?.length, 2, 'Should create diagnostics for 2 invalid keys');

    assert.strictEqual(diagnostics![0].message, 'I18n key \'invalid.key\' not found in locale files');
    assert.strictEqual(diagnostics![1].message, 'I18n key \'another.invalid\' not found in locale files');
  });

  test('should ignore non-haml documents', async () => {
    const document = createMockDocument('erb',
      '<%= I18n.t(\'invalid.key\') %>\n' +
      '<%= t(\'another.invalid\') %>'
    );

    await provider.validateDocument(document);

    const diagnostics = provider.diagnosticCollection.get(document.uri);
    assert.strictEqual(diagnostics?.length, 0, 'Should not process non-haml documents and not set any diagnostics');
  });

  test('should handle empty locales data gracefully', async () => {
    const emptyProvider = new I18nDiagnosticsProvider(new Map());
    const document = createMockDocument('haml', '= I18n.t(\'any.key\')');

    await emptyProvider.validateDocument(document);

    const diagnostics = emptyProvider.diagnosticCollection.get(document.uri);
    assert.strictEqual(diagnostics?.length, 0, 'Should not create diagnostics when locales data is empty and not set any diagnostics');
    emptyProvider.dispose();
  });

  test('should handle documents with no i18n calls', async () => {
    const document = createMockDocument('haml',
      '%div.container\n' +
      '  %h1 Welcome\n' +
      '  %p This is a test\n' +
      '  = user.name'
    );

    await provider.validateDocument(document);

    const diagnostics = provider.diagnosticCollection.get(document.uri);
    assert.strictEqual(diagnostics?.length, 0, 'Should not create diagnostics when no i18n calls are present');
  });

  test('should handle mixed valid and invalid keys', async () => {
    const document = createMockDocument('haml',
      '= I18n.t(\'user.name\')\n' +
      '= I18n.t(\'invalid.key\')\n' +
      '= t(\'admin.dashboard\')\n' +
      '= t(\'another.invalid\')'
    );

    await provider.validateDocument(document);

    const diagnostics = provider.diagnosticCollection.get(document.uri);
    assert.strictEqual(diagnostics?.length, 2, 'Should create diagnostics only for invalid keys');

    const invalidKeys = diagnostics!.map(d => d.message);
    assert.ok(invalidKeys.some(msg => msg.includes('invalid.key')), 'Should include invalid.key diagnostic');
    assert.ok(invalidKeys.some(msg => msg.includes('another.invalid')), 'Should include another.invalid diagnostic');
  });

  test('should validate keys with different quote styles', async () => {
    const document = createMockDocument('haml',
      '= I18n.t("user.name")\n' +
      '= t(\'admin.dashboard\')\n' +
      '= I18n.t("invalid.key")\n' +
      '= t(\'another.invalid\')'
    );

    await provider.validateDocument(document);

    const diagnostics = provider.diagnosticCollection.get(document.uri);
    assert.strictEqual(diagnostics?.length, 2, 'Should handle different quote styles equally');

    assert.ok(diagnostics!.some(d => d.message.includes('invalid.key')), 'Should detect invalid key with double quotes');
    assert.ok(diagnostics!.some(d => d.message.includes('another.invalid')), 'Should detect invalid key with single quotes');
  });

  test('should find keys available in any locale', async () => {
    // messages.success only exists in 'en' locale
    const document = createMockDocument('haml', '= I18n.t(\'messages.success\')');

    await provider.validateDocument(document);

    const diagnostics = provider.diagnosticCollection.get(document.uri);
    assert.strictEqual(diagnostics?.length, 0, 'Should validate keys that exist in any locale');
  });

  test('should handle complex haml with multiple i18n calls', async () => {
    const document = createMockDocument('haml',
      '%div.header\n' +
      '  %h1= I18n.t(\'user.name\')\n' +
      '  %p\n' +
      '    = t(\'admin.dashboard\')\n' +
      '    %span= I18n.t(\'invalid.key\')\n' +
      '%footer\n' +
      '  = t(\'messages.success\')\n' +
      '  = link_to t(\'nonexistent.link\'), "/"\n'
    );

    await provider.validateDocument(document);

    const diagnostics = provider.diagnosticCollection.get(document.uri);
    assert.strictEqual(diagnostics?.length, 2, 'Should create diagnostics for invalid keys in complex structure');

    const invalidKeys = diagnostics!.map(d => d.message);
    assert.ok(invalidKeys.some(msg => msg.includes('invalid.key')), 'Should detect invalid.key');
    assert.ok(invalidKeys.some(msg => msg.includes('nonexistent.link')), 'Should detect nonexistent.link');
  });

  test('should properly dispose of diagnostic collection', () => {
    const testProvider = new I18nDiagnosticsProvider(localesData);

    assert.doesNotThrow(() => {
      testProvider.dispose();
    }, 'Should dispose without throwing errors');
  });

  test('should verify diagnostic position accuracy', async () => {
    const document = createMockDocument('haml', '= I18n.t(\'invalid.key\')');

    await provider.validateDocument(document);

    const diagnostics = provider.diagnosticCollection.get(document.uri);
    assert.strictEqual(diagnostics?.length, 1, 'Should create one diagnostic');

    const diagnostic = diagnostics![0];
    const range = diagnostic.range;

    // Verificar se a posição do diagnóstico está correta para a chave
    assert.strictEqual(document.getText(range), 'invalid.key', 'Diagnostic range should match the key text');
    assert.strictEqual(range.start.line, 0, 'Diagnostic should be on first line');
    assert.ok(range.start.character > 0, 'Diagnostic should start after the quote');
  });

  test('should clear previous diagnostics on new validation', async () => {
    const uri = vscode.Uri.file('/test-clearing.haml');
    const document = createMockDocumentWithUri('haml', '= I18n.t(\'invalid.key\')', uri);

    // First validation with invalid key
    await provider.validateDocument(document);
    let diagnostics = provider.diagnosticCollection.get(uri);
    assert.strictEqual(diagnostics?.length, 1, 'Should have one diagnostic initially');

    // Second validation with valid content using same URI
    const validDocument = createMockDocumentWithUri('haml', '= I18n.t(\'user.name\')', uri);

    await provider.validateDocument(validDocument);
    diagnostics = provider.diagnosticCollection.get(uri);
    assert.strictEqual(diagnostics?.length, 0, 'Should clear previous diagnostics');
  });

  test('should handle multiple documents independently', async () => {
    const uri1 = vscode.Uri.file('/test1.haml');
    const uri2 = vscode.Uri.file('/test2.haml');
    const document1 = createMockDocumentWithUri('haml', '= I18n.t(\'invalid.key1\')', uri1);
    const document2 = createMockDocumentWithUri('haml', '= I18n.t(\'invalid.key2\')', uri2);

    await provider.validateDocument(document1);
    await provider.validateDocument(document2);

    const diagnostics1 = provider.diagnosticCollection.get(uri1);
    const diagnostics2 = provider.diagnosticCollection.get(uri2);

    assert.strictEqual(diagnostics1?.length, 1, 'Document 1 should have one diagnostic');
    assert.strictEqual(diagnostics2?.length, 1, 'Document 2 should have one diagnostic');

    assert.ok(diagnostics1![0].message.includes('invalid.key1'), 'Document 1 should show correct key');
    assert.ok(diagnostics2![0].message.includes('invalid.key2'), 'Document 2 should show correct key');
  });
});

function createMockDocument(languageId: string, text: string): vscode.TextDocument {
  return createMockDocumentWithUri(languageId, text, vscode.Uri.file('/test.haml'));
}

function createMockDocumentWithUri(languageId: string, text: string, uri: vscode.Uri): vscode.TextDocument {
  const lines = text.split('\n');
  let charOffset = 0;
  const lineStarts = [0];

  for (let i = 0; i < lines.length - 1; i++) {
    charOffset += lines[i].length + 1; // +1 for newline
    lineStarts.push(charOffset);
  }

  return {
    languageId,
    getText: (range?: vscode.Range) => {
      if (!range) {
        return text;
      }
      const startOffset = lineStarts[range.start.line] + range.start.character;
      const endOffset = lineStarts[range.end.line] + range.end.character;
      return text.substring(startOffset, endOffset);
    },
    positionAt: (offset: number) => {
      let line = 0;
      while (line < lineStarts.length - 1 && lineStarts[line + 1] <= offset) {
        line++;
      }
      const character = offset - lineStarts[line];
      return new vscode.Position(line, character);
    },
    offsetAt: (position: vscode.Position) => {
      return lineStarts[position.line] + position.character;
    },
    lineCount: lines.length,
    uri: uri,
    version: 1,
    isDirty: false,
    isClosed: false,
    save: async () => true,
    eol: vscode.EndOfLine.LF,
    fileName: uri.fsPath,
    isUntitled: false,
    encoding: 'utf8',
    notebook: undefined,
    lineAt: ((lineOrPosition: number | vscode.Position) => {
      const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
      return {
        lineNumber: line,
        text: lines[line] || '',
        range: new vscode.Range(line, 0, line, (lines[line] || '').length),
        rangeIncludingLineBreak: new vscode.Range(line, 0, line + 1, 0),
        firstNonWhitespaceCharacterIndex: (lines[line] || '').search(/\S/),
        isEmptyOrWhitespace: !/\S/.test(lines[line] || '')
      };
    }) as any,
    getWordRangeAtPosition: () => undefined,
    validateRange: (range: vscode.Range) => range,
    validatePosition: (position: vscode.Position) => position
  } as vscode.TextDocument;
}
