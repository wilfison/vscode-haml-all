import * as fs from 'fs';
import {
  DiagnosticCollection,
  TextDocument,
  Diagnostic,
  DiagnosticSeverity,
  Range,
  Position,
  workspace,
  languages
} from 'vscode';

const I18N_CALL_REGEXP = /(?:I18n\.t|t)\(['"]([^'"]+)['"]/g;

export default class I18nDiagnosticsProvider {
  private diagnosticCollection: DiagnosticCollection;
  private localesCache: Map<string, any> = new Map();
  private lastCacheUpdate = 0;
  private readonly CACHE_TTL = 5000;

  constructor() {
    this.diagnosticCollection = languages.createDiagnosticCollection('i18n');
  }

  public async validateDocument(document: TextDocument): Promise<void> {
    if (document.languageId !== 'haml') {
      return;
    }

    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const localesData = await this.loadLocalesData();

    if (localesData.size === 0) {
      return;
    }

    let match;
    I18N_CALL_REGEXP.lastIndex = 0;

    while ((match = I18N_CALL_REGEXP.exec(text)) !== null) {
      const key = match[1];
      const startPos = document.positionAt(match.index + match[0].indexOf(key));
      const endPos = document.positionAt(match.index + match[0].indexOf(key) + key.length);
      const range = new Range(startPos, endPos);

      if (!this.isValidI18nKey(key, localesData)) {
        const diagnostic = new Diagnostic(
          range,
          `I18n key '${key}' not found in locale files`,
          DiagnosticSeverity.Error
        );
        diagnostic.source = 'i18n-validator';
        diagnostics.push(diagnostic);
      }
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  private async loadLocalesData(): Promise<Map<string, any>> {
    const now = Date.now();

    if (now - this.lastCacheUpdate < this.CACHE_TTL && this.localesCache.size > 0) {
      return this.localesCache;
    }

    this.localesCache.clear();
    this.lastCacheUpdate = now;

    const localeFiles = await workspace.findFiles('config/locales/**/*.{yml,yaml}');

    for (const file of localeFiles) {
      try {
        const content = fs.readFileSync(file.fsPath, 'utf8');
        const data = this.parseYaml(content);

        if (data && typeof data === 'object') {
          for (const [locale, localeData] of Object.entries(data)) {
            this.localesCache.set(locale, localeData);
          }
        }
      } catch (error) {
        console.error(`Error loading locale file ${file.fsPath}:`, error);
      }
    }

    return this.localesCache;
  }

  private isValidI18nKey(key: string, localesData: Map<string, any>): boolean {
    for (const [, data] of localesData) {
      if (this.hasKey(data, key)) {
        return true;
      }
    }
    return false;
  }

  private hasKey(data: any, key: string): boolean {
    const parts = key.split('.');
    let current = data;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return false;
      }
    }

    return typeof current === 'string';
  }

  private parseYaml(content: string): any {
    try {
      const lines = content.split('\n');
      const result: any = {};
      const stack: any[] = [result];
      let currentIndent = 0;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        const indent = line.length - line.trimStart().length;
        const colonIndex = trimmed.indexOf(':');

        if (colonIndex === -1) {
          continue;
        }

        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();

        while (stack.length > 1 && indent <= currentIndent) {
          stack.pop();
          currentIndent -= 2;
        }

        const current = stack[stack.length - 1];

        if (value === '' || value === '{}') {
          current[key] = {};
          stack.push(current[key]);
          currentIndent = indent;
        } else {
          current[key] = value.replace(/^['"]|['"]$/g, '');
        }
      }

      return result;
    } catch (error) {
      console.error('YAML parsing error:', error);
      return {};
    }
  }

  public dispose(): void {
    this.diagnosticCollection.dispose();
  }
}
