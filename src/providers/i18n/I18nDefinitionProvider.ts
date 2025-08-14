import * as fs from 'node:fs';

import {
  TextDocument,
  Position,
  DefinitionProvider,
  DefinitionLink,
  Location,
  Range,
  Uri
} from 'vscode';

import { CacheLocaleType, loadLocalesData } from '../../ultils/yaml';

const I18N_KEY_REGEXP = /(?:I18n\.t|t)\(['"]([^'"]*)$/;

export default class I18nDefinitionProvider implements DefinitionProvider {
  private localesCache: CacheLocaleType = new Map();
  private lastCacheUpdate = 0;
  private readonly CACHE_TTL = 5000;

  public async provideDefinition(document: TextDocument, position: Position): Promise<DefinitionLink[]> {
    const line = document.lineAt(position.line).text;
    const character = position.character;

    const beforeCursor = line.substring(0, character);
    const afterCursor = line.substring(character);

    const beforeMatch = beforeCursor.match(I18N_KEY_REGEXP);
    const afterMatch = afterCursor.match(/^([^'"]*)['"]/);

    if (!beforeMatch || !afterMatch) {
      return [];
    }

    const key = beforeMatch[1] + afterMatch[1];
    const keyStart = beforeMatch.index! + beforeMatch[0].indexOf(beforeMatch[1]);
    const keyEnd = keyStart + key.length;

    const keyRange = new Range(
      new Position(position.line, keyStart),
      new Position(position.line, keyEnd)
    );

    const definitions = await this.findKeyDefinitions(key);

    return definitions.map(def => ({
      targetUri: def.uri,
      targetRange: def.range,
      targetSelectionRange: def.range,
      originSelectionRange: keyRange
    }));
  }

  private async findKeyDefinitions(key: string): Promise<Location[]> {
    const localesData = await this.loadLocalesData();
    const definitions: Location[] = [];

    for (const [locale, { data, file }] of localesData) {
      const location = this.findKeyInData(data, key, file);
      if (location) {
        definitions.push(location);
      }
    }

    return definitions;
  }

  private findKeyInData(data: any, key: string, filePath: string): Location | null {
    const parts = key.split('.');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');

    let currentPath: string[] = [];
    let targetIndent = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const indent = line.length - line.trimStart().length;
      const colonIndex = trimmed.indexOf(':');

      if (colonIndex === -1) {
        continue;
      }

      const lineKey = trimmed.substring(0, colonIndex).trim();

      if (targetIndent >= 0 && indent <= targetIndent) {
        while (currentPath.length > 0 && indent <= this.getIndentForDepth(currentPath.length - 1)) {
          currentPath.pop();
        }
        targetIndent = -1;
      }

      if (indent > (currentPath.length > 0 ? this.getIndentForDepth(currentPath.length) : -1)) {
        currentPath.push(lineKey);

        if (currentPath.join('.') === key) {
          const position = new Position(i, line.indexOf(lineKey));
          const range = new Range(position, new Position(i, line.indexOf(lineKey) + lineKey.length));
          return new Location(Uri.file(filePath), range);
        }

        if (key.startsWith(currentPath.join('.') + '.')) {
          targetIndent = indent;
        }
      }
    }

    return null;
  }

  private getIndentForDepth(depth: number): number {
    return depth * 2;
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
}
