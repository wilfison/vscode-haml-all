import * as fs from 'node:fs';

import {
  CompletionItemProvider,
  TextDocument,
  Position,
  Range,
  workspace,
  CompletionItem,
  CompletionItemKind,
  MarkdownString,
} from 'vscode';

import { CacheLocaleType } from '../../ultils/yaml';
import { I18nLocaleConfig } from '.';

const I18N_REGEXP = /(?:I18n\.t|t)\s*\(?['"]([^'"]*)/;

export default class I18nCompletionProvider implements CompletionItemProvider {
  constructor(
    private localesData: CacheLocaleType,
    private localeConfig: I18nLocaleConfig
  ) {}

  public async provideCompletionItems(document: TextDocument, position: Position): Promise<CompletionItem[] | null> {
    const line = document.getText(new Range(new Position(position.line, 0), position));
    const matches = line.match(I18N_REGEXP);

    if (!matches) {
      return null;
    }

    const completions = await this.getI18nCompletions();

    return completions;
  }

  private async getI18nCompletions(): Promise<CompletionItem[]> {
    const defaultLocale = this.localeConfig.defaultLocale;
    const completions: CompletionItem[] = [];
    const addedKeys: Map<string, number> = new Map();

    // Priorize default locale
    const preferredLocale = this.localesData.get(defaultLocale) ? defaultLocale : this.localesData.keys().next().value || 'en';

    for (const [locale, data] of this.localesData) {
      const keys = Object.keys(data);

      for (const key of keys) {
        const value = data[key].value;
        const item = new CompletionItem(key, CompletionItemKind.Text);

        item.detail = `[${locale}] ${value}`;
        item.documentation = new MarkdownString(`**Locale:** ${locale}\n\n**Value:** ${value}`);
        item.insertText = key;

        if (locale === preferredLocale && addedKeys.has(key)) {
          const existingIndex = addedKeys.get(key) || 0;
          completions[existingIndex] = item;
        } else if (!addedKeys.has(key)) {
          completions.push(item);
          addedKeys.set(key, completions.length - 1);
        }
      }
    }

    return completions;
  }
}
