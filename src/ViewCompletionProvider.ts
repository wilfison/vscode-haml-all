import * as path from 'path';
import {
  CompletionItemProvider,
  TextDocument,
  Position,
  Range,
  workspace,
  CompletionItem,
  CompletionItemKind,
  Uri
} from 'vscode';

import { CompletionItemWithScore } from './types';

const RENDER_REGEXP = /[^\w.]render(?:\s+|\()['"]([\w\d_\/]*)$/;

const matchScore = (path1: string, path2: string): number => {
  const parts1 = path1.split(path.sep).slice(0, -1);
  const parts2 = path2.split(path.sep).slice(0, -1);

  return parts1.reduce((score, part, index) => {
    return part === parts2[index] ? score + 1 : score;
  }, 0);
};

const viewPathForRelativePath = (partialPath: Uri): string => {
  const search = path.join('app', 'views') + path.sep;

  return workspace.asRelativePath(partialPath).replace(search, '');
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
    const partialPaths = await workspace.findFiles('app/views/**/_*');
    const viewPaths = partialPaths.map(viewPathForRelativePath);
    const currentViewPath = viewPathForRelativePath(document.uri);

    const itemsWithScore = viewPaths.map(viewPath => ({
      item: this.buildCompletionItem(viewPath, currentViewPath),
      score: matchScore(currentViewPath, viewPath)
    }));

    const maxItemWithScore = itemsWithScore.reduce<CompletionItemWithScore>((maxItem, currentItem) => {
      return currentItem.score > maxItem.score ? currentItem : maxItem;
    }, { item: null, score: -1 });

    if (!maxItemWithScore.item) {
      return null;
    }

    maxItemWithScore.item.preselect = true;

    return itemsWithScore.map(({ item }) => item);
  }

  private buildCompletionItem(viewPath: string, currentViewPath: string): CompletionItem {
    let parts = viewPath.split(path.sep);
    const fileName = parts.pop();
    const baseName = fileName?.split('.', 2)[0].slice(1) || '';

    if (currentViewPath.startsWith(parts.join(path.sep))) {
      parts = parts.slice(currentViewPath.split(path.sep).length - 1);
    }

    const partialPath = [...parts, baseName].join(path.sep);

    const item = new CompletionItem(partialPath, CompletionItemKind.File);
    item.detail = viewPath;

    return item;
  }
}
