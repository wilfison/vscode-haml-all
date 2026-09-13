import {
  CompletionItemProvider,
  TextDocument,
  Position,
  Range,
  workspace,
  CompletionItem,
  CompletionItemKind,
  Uri,
} from 'vscode';

import { CompletionItemWithScore } from '../types';
import { getPartialIndex, PartialFile } from '../rails/partialIndex';
import { toPosix } from '../utils/file';

const RENDER_REGEXP = /[^\w.]render(?:\s+|\()['"]([\w\d_\/]*)$/;

export const matchScore = (path1: string, path2: string): number => {
  const parts1 = path1.split('/').slice(0, -1);
  const parts2 = path2.split('/').slice(0, -1);

  return parts1.reduce((score, part, index) => {
    return part === parts2[index] ? score + 1 : score;
  }, 0);
};

export const viewPathForRelativePath = (partialPath: Uri): string => {
  return toPosix(workspace.asRelativePath(partialPath)).replace('app/views/', '');
};

export default class ViewCompletionProvider implements CompletionItemProvider {
  public async provideCompletionItems(document: TextDocument, position: Position): Promise<CompletionItem[] | null> {
    const line = document.getText(new Range(new Position(position.line, 0), position));
    const matches = line.match(RENDER_REGEXP);

    if (!matches) {
      return null;
    }

    return this.buildCompletionItems(document);
  }

  private async buildCompletionItems(document: TextDocument): Promise<CompletionItem[] | null> {
    // One item per partial, not per template: a Turbo app has `_row.html.haml`
    // next to `_row.turbo_stream.haml`, and `render "row"` names both.
    const byPartial = new Map<string, PartialFile[]>();

    for (const partial of await getPartialIndex()) {
      const key = `${partial.viewsRoot}/${partial.logicalPath}`;
      byPartial.set(key, [...(byPartial.get(key) ?? []), partial]);
    }

    const currentViewPath = viewPathForRelativePath(document.uri);

    const itemsWithScore = Array.from(byPartial.values()).map((templates) => {
      const viewPath = `${templates[0].logicalPath}.${templates[0].variant}`;
      const item = this.buildCompletionItem(viewPath, currentViewPath);
      item.detail = templates.map((template) => `${template.logicalPath}.${template.variant}`).join(', ');

      return { item, score: matchScore(currentViewPath, viewPath) };
    });

    const maxItemWithScore = itemsWithScore.reduce<CompletionItemWithScore>(
      (maxItem, currentItem) => {
        return currentItem.score > maxItem.score ? currentItem : maxItem;
      },
      { item: null, score: -1 }
    );

    if (!maxItemWithScore.item) {
      return null;
    }

    maxItemWithScore.item.preselect = true;

    return itemsWithScore.map(({ item }) => item);
  }

  public buildCompletionItem(viewPath: string, currentViewPath: string): CompletionItem {
    let parts = viewPath.split('/');
    const fileName = parts.pop();
    const baseName = fileName?.split('.', 2)[0].slice(1) || '';

    if (currentViewPath.startsWith(parts.join('/'))) {
      parts = parts.slice(currentViewPath.split('/').length - 1);
    }

    const partialPath = [...parts, baseName].join('/');

    const item = new CompletionItem(partialPath, CompletionItemKind.File);
    item.detail = viewPath;

    return item;
  }
}
