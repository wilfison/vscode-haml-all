import { OutputChannel } from 'vscode';

import I18nDiagnosticsProvider from './I18nDiagnosticsProvider';
import I18nCompletionProvider from './I18nCompletionProvider';
import I18nDefinitionProvider from './I18nDefinitionProvider';

import { CacheLocaleType, loadLocalesData } from '../../ultils/yaml';

class I18nProvider {
  private localesData: CacheLocaleType = new Map();

  public i18nDiagnosticsProvider: I18nDiagnosticsProvider;
  public i18nCompletionProvider: I18nCompletionProvider;
  public i18nDefinitionProvider: I18nDefinitionProvider;

  constructor(private outputChannel: OutputChannel) {
    this.i18nDiagnosticsProvider = new I18nDiagnosticsProvider(this.localesData);
    this.i18nCompletionProvider = new I18nCompletionProvider(this.localesData);
    this.i18nDefinitionProvider = new I18nDefinitionProvider(this.localesData);

    this.loadLocalesData();
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
}

export default I18nProvider;
