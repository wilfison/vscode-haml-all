import * as fs from 'node:fs';
import { FileSystemWatcher, OutputChannel, workspace } from 'vscode';

import I18nDiagnosticsProvider from './I18nDiagnosticsProvider';
import I18nCompletionProvider from './I18nCompletionProvider';
import I18nDefinitionProvider from './I18nDefinitionProvider';

import { CacheLocaleType, loadLocalesData } from '../../ultils/yaml';

export type I18nLocaleConfig = {
  defaultLocale: string;
};

class I18nProvider {
  private localesData: CacheLocaleType = new Map();
  private localeConfig: I18nLocaleConfig = {
    defaultLocale: 'en',
  };

  public i18nDiagnosticsProvider: I18nDiagnosticsProvider;
  public i18nCompletionProvider: I18nCompletionProvider;
  public i18nDefinitionProvider: I18nDefinitionProvider;

  constructor(private outputChannel: OutputChannel) {
    this.i18nDiagnosticsProvider = new I18nDiagnosticsProvider(this.localesData);
    this.i18nCompletionProvider = new I18nCompletionProvider(this.localesData, this.localeConfig);
    this.i18nDefinitionProvider = new I18nDefinitionProvider(this.localesData);

    this.setupData();
  }

  async setupData(): Promise<void> {
    await this.loadLocalesData();

    await this.setDefaultLocale();
    this.outputChannel.appendLine(`Default I18n locale set to: ${this.localeConfig.defaultLocale}`);
  }

  async loadLocalesData(): Promise<void> {
    this.localesData.clear();

    try {
      await loadLocalesData(this.localesData);
      this.outputChannel.appendLine('I18n locales data loaded successfully.');
    } catch (error: any) {
      this.outputChannel.appendLine(`Error loading i18n locales data: ${error.message}`);
    }
  }

  dispose(): void {
    this.localesData.clear();
    this.i18nDiagnosticsProvider.dispose();
  }

  subscribeFileWatcher(): FileSystemWatcher {
    const watcher = workspace.createFileSystemWatcher('**/config/locales/**/*.yml');

    watcher.onDidChange(this.setupData.bind(this));
    watcher.onDidCreate(this.setupData.bind(this));

    return watcher;
  }

  private async setDefaultLocale(): Promise<void> {
    // Try to find Rails configuration
    try {
      const configFiles = await workspace.findFiles('config/**/*.rb');

      for (const file of configFiles) {
        const content = fs.readFileSync(file.fsPath, 'utf8');
        const match = content.match(/(?:config\.)?i18n\.default_locale\s*=\s*['":]*([^'"\s]+)/i);

        if (match) {
          this.localeConfig.defaultLocale = match[1];
          this.outputChannel.appendLine(`Default locale (${this.localeConfig.defaultLocale}) found in Rails config (${file.fsPath})`);
          return;
        }
      }
    } catch (error) {
      console.error('Error reading Rails config files:', error);
    }

    // Fallback for common locales
    const preferredOrder = ['en', 'pt', 'pt-BR', 'es', 'fr'];

    for (const locale of preferredOrder) {
      if (this.localesData.has(locale)) {
        this.localeConfig.defaultLocale = locale;
        return;
      }
    }

    // If none of the preferred locales are found, use the first available
    const firstLocale = this.localesData.keys().next().value;
    this.localeConfig.defaultLocale = firstLocale || 'en';
    return;
  }
}

export default I18nProvider;
