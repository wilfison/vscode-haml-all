import { DiagnosticCollection, TextDocument, Diagnostic, DiagnosticSeverity, Range, languages, workspace } from 'vscode';

import { CacheLocaleType } from '../../ultils/yaml';

const I18N_CALL_REGEXP = /[\s\(]+(?:I18n\.t|t)\(['"]([^'"#]+)['"]/g;

export default class I18nDiagnosticsProvider {
  public diagnosticCollection: DiagnosticCollection;

  constructor(private localesData: CacheLocaleType) {
    this.diagnosticCollection = languages.createDiagnosticCollection('i18n');
  }

  public async validateDocument(document: TextDocument): Promise<void> {
    if (document.languageId !== 'haml') {
      return;
    }

    // Check if I18n validation is enabled
    const config = workspace.getConfiguration('hamlAll');
    const isEnabled = config.get<boolean>('i18nValidation.enabled', true);

    if (!isEnabled) {
      // Clear any existing diagnostics if validation is disabled
      this.diagnosticCollection.delete(document.uri);
      return;
    }

    const diagnostics: Diagnostic[] = [];
    const text = document.getText();

    if (this.localesData.size === 0) {
      return;
    }

    let match;
    I18N_CALL_REGEXP.lastIndex = 0;

    while ((match = I18N_CALL_REGEXP.exec(text)) !== null) {
      const key = match[1];
      const startPos = document.positionAt(match.index + match[0].indexOf(key));
      const endPos = document.positionAt(match.index + match[0].indexOf(key) + key.length);
      const range = new Range(startPos, endPos);

      if (!this.isValidI18nKey(key)) {
        const diagnostic = new Diagnostic(range, `I18n key '${key}' not found in locale files`, DiagnosticSeverity.Error);

        diagnostic.source = 'i18n-validator';
        diagnostics.push(diagnostic);
      }
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  private isValidI18nKey(key: string): boolean {
    for (const [_locale, data] of this.localesData) {
      if (data[key]) {
        return true;
      }
    }

    return false;
  }

  public dispose(): void {
    this.diagnosticCollection.dispose();
  }
}
