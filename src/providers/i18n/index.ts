import * as fs from 'node:fs';
import { FileSystemWatcher, OutputChannel, workspace } from 'vscode';

import I18nDiagnosticsProvider from './I18nDiagnosticsProvider';
import I18nCompletionProvider from './I18nCompletionProvider';
import I18nDefinitionProvider from './I18nDefinitionProvider';

import { CacheLocaleType, loadLocalesData } from '../../utils/yaml';

export type I18nLocaleConfig = {
  defaultLocale: string;
};

/**
 * Manages I18n (internationalization) features including completion, definition, and diagnostics.
 * Implements caching to improve performance when loading locale files.
 */
class I18nProvider {
  private localesData: CacheLocaleType = new Map();
  private localeConfig: I18nLocaleConfig = {
    defaultLocale: 'en',
  };

  // Cache management
  private lastLoadTime: number = 0;
  private localeFilesModifiedTimes: Map<string, number> = new Map();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  public i18nDiagnosticsProvider: I18nDiagnosticsProvider;
  public i18nCompletionProvider: I18nCompletionProvider;
  public i18nDefinitionProvider: I18nDefinitionProvider;

  constructor(private outputChannel: OutputChannel) {
    this.i18nDiagnosticsProvider = new I18nDiagnosticsProvider(this.localesData);
    this.i18nCompletionProvider = new I18nCompletionProvider(this.localesData, this.localeConfig);
    this.i18nDefinitionProvider = new I18nDefinitionProvider(this.localesData);

    this.setupData();
  }

  /**
   * Checks if any locale files have been modified since last load.
   * @returns true if cache is valid, false if files have been modified
   */
  private async isCacheValid(): Promise<boolean> {
    const now = Date.now();
    const cacheAge = now - this.lastLoadTime;

    // Check if cache has expired
    if (cacheAge > this.CACHE_TTL) {
      this.outputChannel.appendLine('I18n cache expired (TTL exceeded)');
      return false;
    }

    // Check if any locale files have been modified
    try {
      const localeFiles = await workspace.findFiles('config/locales/**/*.{yml,yaml}');

      for (const file of localeFiles) {
        const filePath = file.fsPath;
        const stats = fs.statSync(filePath);
        const currentModTime = stats.mtimeMs;
        const cachedModTime = this.localeFilesModifiedTimes.get(filePath) || 0;

        if (currentModTime > cachedModTime) {
          this.outputChannel.appendLine(`I18n cache invalidated (${filePath} modified)`);
          return false;
        }
      }

      // Check if files were deleted
      if (localeFiles.length !== this.localeFilesModifiedTimes.size) {
        this.outputChannel.appendLine('I18n cache invalidated (files added/removed)');
        return false;
      }
    } catch (error) {
      this.outputChannel.appendLine(`Error checking locale files: ${error}`);
      return false;
    }

    return true;
  }

  /**
   * Updates cache metadata with current file modification times.
   */
  private async updateCacheMetadata(): Promise<void> {
    this.localeFilesModifiedTimes.clear();

    try {
      const localeFiles = await workspace.findFiles('config/locales/**/*.{yml,yaml}');

      for (const file of localeFiles) {
        const stats = fs.statSync(file.fsPath);
        this.localeFilesModifiedTimes.set(file.fsPath, stats.mtimeMs);
      }

      this.lastLoadTime = Date.now();
    } catch (error) {
      this.outputChannel.appendLine(`Error updating I18n cache metadata: ${error}`);
    }
  }

  async setupData(): Promise<void> {
    await this.loadLocalesData();

    await this.setDefaultLocale();
    this.outputChannel.appendLine(`Default I18n locale set to: ${this.localeConfig.defaultLocale}`);
  }

  async loadLocalesData(): Promise<void> {
    // Return cached data if still valid
    if (this.localesData.size > 0 && (await this.isCacheValid())) {
      this.outputChannel.appendLine(`Using cached I18n data (${this.localesData.size} locales)`);
      return;
    }

    this.outputChannel.appendLine('Loading I18n locales data...');
    this.localesData.clear();

    try {
      await loadLocalesData(this.localesData);
      await this.updateCacheMetadata();
      this.outputChannel.appendLine(
        `I18n locales data loaded successfully (${this.localesData.size} locales, cached for ${this.CACHE_TTL / 1000}s).`
      );
    } catch (error: any) {
      this.outputChannel.appendLine(`Error loading i18n locales data: ${error.message}`);
    }
  }

  dispose(): void {
    this.localesData.clear();
    this.localeFilesModifiedTimes.clear();
    this.i18nDiagnosticsProvider.dispose();
  }

  subscribeFileWatcher(): FileSystemWatcher {
    const watcher = workspace.createFileSystemWatcher('**/config/locales/**/*.yml');

    watcher.onDidChange(this.setupData.bind(this));
    watcher.onDidCreate(this.setupData.bind(this));

    return watcher;
  }

  isI18nValidationEnabled(): boolean {
    const config = workspace.getConfiguration('hamlAll');
    return config.get<boolean>('i18nValidation.enabled', true);
  }

  private async setDefaultLocale(): Promise<void> {
    // Check for user-configured default locale first
    const config = workspace.getConfiguration('hamlAll');
    const userDefaultLocale = config.get<string>('i18nValidation.defaultLocale', '').trim();

    if (userDefaultLocale && this.localesData.has(userDefaultLocale)) {
      this.localeConfig.defaultLocale = userDefaultLocale;
      this.outputChannel.appendLine(`Default locale (${this.localeConfig.defaultLocale}) set from user configuration`);
      return;
    } else if (userDefaultLocale) {
      this.outputChannel.appendLine(
        `Warning: User-configured default locale '${userDefaultLocale}' not found in available locales. Falling back to auto-detection.`
      );
    }

    // Try to find Rails configuration
    try {
      const configFiles = await workspace.findFiles('config/**/*.rb');

      for (const file of configFiles) {
        const content = fs.readFileSync(file.fsPath, 'utf8');
        const match = content.match(/(?:config\.)?i18n\.default_locale\s*=\s*['":]*([^'"\s]+)/i);

        if (match) {
          this.localeConfig.defaultLocale = match[1];
          this.outputChannel.appendLine(
            `Default locale (${this.localeConfig.defaultLocale}) found in Rails config (${file.fsPath})`
          );
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
