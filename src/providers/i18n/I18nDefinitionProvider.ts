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

import { CacheLocaleType } from '../../ultils/yaml';

const I18N_KEY_REGEXP = /(?:I18n\.t|t)\(['"]([^'"]*)$/;

export default class I18nDefinitionProvider implements DefinitionProvider {
  constructor(private localesData: CacheLocaleType) {
  }

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

    const definitions = await this.findKeyDefinitions(key, line);

    return definitions.map(def => ({
      targetUri: def.uri,
      targetRange: def.range,
      targetSelectionRange: def.range,
      originSelectionRange: keyRange
    }));
  }

  private async findKeyDefinitions(key: string, line: string): Promise<Location[]> {
    const definitions: Location[] = [];

    for (const [locale, data] of this.localesData) {
      const dataKey = data[key];

      if (!dataKey) {
        continue;
      }

      const position = new Position(dataKey.file_line, 0);
      const range = new Range(position, new Position(dataKey.file_line, line.length - 1));
      const location = new Location(Uri.file(dataKey.file_path), range);

      definitions.push(location);
    }

    return definitions;
  }
}
