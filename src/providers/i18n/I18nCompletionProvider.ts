import * as fs from 'node:fs';

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

import { CacheLocaleType, loadLocalesData } from '../../ultils/yaml';

const I18N_REGEXP = /(?:I18n\.t|t)\s*\(?['"]([^'"]*)/;

export default class I18nCompletionProvider implements CompletionItemProvider {
  private localesCache: CacheLocaleType = new Map();
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

    // Priorize default locale
    const preferredLocale = localesData.get(defaultLocale) ? defaultLocale : localesData.keys().next().value;

    if (preferredLocale && localesData.has(preferredLocale)) {
      const data = localesData.get(preferredLocale)?.data;
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

    if (completions.length === 0) {
      for (const [locale, { data }] of localesData) {
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

  private async loadLocalesData(): Promise<CacheLocaleType> {
    const now = Date.now();

    if (now - this.lastCacheUpdate < this.CACHE_TTL && this.localesCache.size > 0) {
      return this.localesCache;
    }

    this.localesCache.clear();
    this.lastCacheUpdate = now;

    await loadLocalesData(this.localesCache);

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

    // Try to find Rails configuration
    try {
      const configFiles = await workspace.findFiles('config/**/*.rb');

      for (const file of configFiles) {
        const content = fs.readFileSync(file.fsPath, 'utf8');
        const match = content.match(/(?:config\.)?i18n\.default_locale\s*=\s*['":]*([^'"\s]+)/i);

        if (match) {
          this.defaultLocale = match[1];
          return this.defaultLocale;
        }
      }
    } catch (error) {
      console.error('Error reading Rails config files:', error);
    }

    // Fallback for common locales
    const localesData = await this.loadLocalesData();
    const preferredOrder = ['en', 'pt', 'pt-BR', 'es', 'fr'];

    for (const locale of preferredOrder) {
      if (localesData.has(locale)) {
        this.defaultLocale = locale;
        return this.defaultLocale;
      }
    }

    // If none of the preferred locales are found, use the first available
    const firstLocale = localesData.keys().next().value;
    this.defaultLocale = firstLocale || 'en';
    return this.defaultLocale;
  }
}
