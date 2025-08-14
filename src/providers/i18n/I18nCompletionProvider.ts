import * as fs from 'fs';
import {
  CompletionItemProvider,
  TextDocument,
  Position,
  Range,
  workspace,
  CompletionItem,
  CompletionItemKind,
  MarkdownString
} from 'vscode';

const I18N_REGEXP = /(?:I18n\.t|t)\s*\(?['"]([^'"]*)/;

export default class I18nCompletionProvider implements CompletionItemProvider {
  private localesCache: Map<string, any> = new Map();
  private lastCacheUpdate = 0;
  private readonly CACHE_TTL = 5000;
  private defaultLocale: string | null = null;

  public async provideCompletionItems(document: TextDocument, position: Position): Promise<CompletionItem[] | null> {
    const line = document.getText(new Range(new Position(position.line, 0), position));
    const matches = line.match(I18N_REGEXP);

    if (!matches) {
      return null;
    }

    const partialKey = matches[1];
    const completions = await this.getI18nCompletions(partialKey);

    return completions;
  }

  private async getI18nCompletions(partialKey: string): Promise<CompletionItem[]> {
    const localesData = await this.loadLocalesData();
    const defaultLocale = await this.getDefaultLocale();
    const completions: CompletionItem[] = [];
    const addedKeys = new Set<string>();

    // Priorizar o locale padrão
    const preferredLocale = localesData.get(defaultLocale) ? defaultLocale : localesData.keys().next().value;

    if (preferredLocale && localesData.has(preferredLocale)) {
      const data = localesData.get(preferredLocale);
      const keys = this.extractKeys(data, partialKey);

      for (const key of keys) {
        if (!addedKeys.has(key)) {
          const value = this.getValueForKey(data, key);
          const item = new CompletionItem(key, CompletionItemKind.Text);

          item.detail = `[${preferredLocale}] ${value}`;
          item.documentation = new MarkdownString(`**Locale:** ${preferredLocale}\n\n**Value:** ${value}`);
          item.insertText = key;

          completions.push(item);
          addedKeys.add(key);
        }
      }
    }

    // Se não houver chaves suficientes, adicionar de outros locales
    if (completions.length === 0) {
      for (const [locale, data] of localesData) {
        if (locale === preferredLocale) {
          continue;
        }

        const keys = this.extractKeys(data, partialKey);

        for (const key of keys) {
          if (!addedKeys.has(key)) {
            const value = this.getValueForKey(data, key);
            const item = new CompletionItem(key, CompletionItemKind.Text);

            item.detail = `[${locale}] ${value}`;
            item.documentation = new MarkdownString(`**Locale:** ${locale}\n\n**Value:** ${value}`);
            item.insertText = key;

            completions.push(item);
            addedKeys.add(key);
          }
        }
      }
    }

    return completions;
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

  private extractKeys(data: any, partialKey: string, prefix = ''): string[] {
    const keys: string[] = [];

    if (!data || typeof data !== 'object') {
      return keys;
    }

    for (const [key, value] of Object.entries(data)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (fullKey.startsWith(partialKey) || partialKey === '') {
        if (typeof value === 'string') {
          keys.push(fullKey);
        } else if (typeof value === 'object' && value !== null) {
          keys.push(...this.extractKeys(value, partialKey, fullKey));
        }
      } else if (partialKey.startsWith(fullKey + '.')) {
        if (typeof value === 'object' && value !== null) {
          keys.push(...this.extractKeys(value, partialKey, fullKey));
        }
      }
    }

    return keys;
  }

  private getValueForKey(data: any, key: string): string {
    const parts = key.split('.');
    let current = data;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return '';
      }
    }

    return typeof current === 'string' ? current : '';
  }

  private async getDefaultLocale(): Promise<string> {
    if (this.defaultLocale) {
      return this.defaultLocale;
    }

    // Tentar encontrar configuração do Rails
    try {
      const configFiles = await workspace.findFiles('config/**/*.rb');

      for (const file of configFiles) {
        const content = fs.readFileSync(file.fsPath, 'utf8');
        const match = content.match(/(?:config\.)?i18n\.default_locale\s*=\s*['":]*([^'"\s]+)/i);

        if (match) {
          this.defaultLocale = match[1];
          console.log(`Default locale found in Rails config: ${this.defaultLocale}`);
          return this.defaultLocale;
        }
      }
    } catch (error) {
      console.error('Error reading Rails config files:', error);
    }

    // Fallback para locales comuns
    const localesData = await this.loadLocalesData();
    const preferredOrder = ['en', 'pt', 'pt-BR', 'es', 'fr'];

    for (const locale of preferredOrder) {
      if (localesData.has(locale)) {
        this.defaultLocale = locale;
        return this.defaultLocale;
      }
    }

    // Se não encontrar nenhum dos preferidos, usar o primeiro disponível
    const firstLocale = localesData.keys().next().value;
    this.defaultLocale = firstLocale || 'en';
    return this.defaultLocale;
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
}
