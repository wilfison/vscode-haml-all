import * as path from 'path';

import {
  CompletionItem,
  CompletionItemKind,
  CompletionItemProvider,
  TextDocument,
  Range,
  Position,
  Uri,
  workspace,
} from 'vscode';

import Routes from '../rails/routes';
import { buildRouteHelperDetails, buildRouteHelperSnippet } from '../rails/utils';

const LINE_REGEXP = /(?:link_to|redirect_to|button_to|form_for|visit|url|path|href)/;

const matchScore = (path1: string, path2: string): number => {
  const parts1 = path1.split(path.sep);
  const parts2 = path2.split(path.sep);

  let score = 0;
  parts1.some((part, index) => {
    if (part === parts2[index]) {
      score += 1;
      return false;
    }
    return true;
  });

  return score;
};

export default class RoutesCompletionProvider implements CompletionItemProvider {
  constructor(private routes: Routes) {}

  public provideCompletionItems(document: TextDocument, position: Position) {
    const line = document.getText(new Range(new Position(position.line, 0), new Position(position.line, position.character)));

    const matches = line.match(LINE_REGEXP);

    if (!matches) {
      return null;
    }

    return this.buildCompletionItems(document.uri);
  }

  private buildCompletionItems(currentUri: Uri) {
    const currentController = workspace.asRelativePath(currentUri).replace(/app\/(?:controllers|views)\//, '');

    const rootPath = workspace.getWorkspaceFolder(currentUri)?.uri.fsPath || '';
    const itemsWithScore: { item: CompletionItem; score: number }[] = [];

    Array.from(this.routes.getAll()).forEach(([prefix, route]) => {
      const item = new CompletionItem(`${prefix}_path`, CompletionItemKind.Method);

      item.detail = buildRouteHelperDetails(route, rootPath);
      item.insertText = buildRouteHelperSnippet(prefix, route.params);

      itemsWithScore.push({ item, score: matchScore(currentController, route.controller) });
    });

    const scores = itemsWithScore.map(({ score }) => score);
    const maxScore = Math.max(...scores);
    const maxScoreItemWithScore = itemsWithScore.find(({ score }) => score === maxScore);
    if (!maxScoreItemWithScore) {
      return null;
    }
    maxScoreItemWithScore.item.preselect = true;

    return itemsWithScore.map(({ item }) => item);
  }
}
