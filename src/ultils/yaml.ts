import fs from 'node:fs';
import { workspace } from 'vscode';

export function parseYaml(content: string): any {
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

export type CacheLocaleType = Map<string, { data: any; file: string }>;

export async function loadLocalesData(cacheMap: CacheLocaleType): Promise<CacheLocaleType> {
  const localeFiles = await workspace.findFiles('config/locales/**/*.{yml,yaml}');

  for (const file of localeFiles) {
    try {
      const content = fs.readFileSync(file.fsPath, 'utf8');
      const data = parseYaml(content);

      if (data && typeof data === 'object') {
        for (const [locale, localeData] of Object.entries(data)) {
          cacheMap.set(locale, { data: localeData, file: file.fsPath });
        }
      }
    } catch (error) {
      console.error(`Error loading locale file ${file.fsPath}:`, error);
    }
  }

  return cacheMap;
}
