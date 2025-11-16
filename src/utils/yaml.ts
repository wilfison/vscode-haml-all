import fs from 'node:fs';
import { workspace } from 'vscode';

export type CacheLocaledataType = {
  [key: string]: {
    value: string;
    file_path: string;
    file_line: number;
  };
};

export type CacheLocaleType = Map<string, CacheLocaledataType>;

export function parseYaml(filePath: string): any {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const result: any = {};
    const stack: any[] = [result];

    let currentIndent = 0;
    let currentLine = -1;

    for (const line of lines) {
      currentLine += 1;

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
        current[key] = {
          value: value.replace(/^['"]|['"]$/g, ''),
          file_path: filePath,
          file_line: currentLine,
        };
      }
    }

    return result;
  } catch (error) {
    console.error('YAML parsing error:', error);
    return {};
  }
}

export async function loadLocalesData(cacheMap: CacheLocaleType): Promise<CacheLocaleType> {
  const localeFiles = await workspace.findFiles('config/locales/**/*.{yml,yaml}');

  for (const file of localeFiles) {
    try {
      const data = parseYaml(file.fsPath);

      if (data && typeof data === 'object') {
        for (const [locale, localeData] of Object.entries(data)) {
          cacheMap.set(locale, locateDataToI18nKeys(localeData as CacheLocaledataType));
        }
      }
    } catch (error) {
      console.error(`Error loading locale file ${file.fsPath}:`, error);
    }
  }

  return cacheMap;
}

function locateDataToI18nKeys(localeData: CacheLocaledataType): CacheLocaledataType {
  const result: CacheLocaledataType = {};

  function traverse(data: any, path: string[] = []) {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && !('value' in value)) {
        traverse(value, [...path, key]);
      } else if (value && typeof value === 'object' && 'value' in value) {
        const fullPath = [...path, key].join('.');
        result[fullPath] = value as { value: string; file_path: string; file_line: number };
      }
    }
  }

  traverse(localeData);
  return result;
}
