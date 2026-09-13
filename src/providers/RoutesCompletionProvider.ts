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
import { toPosix } from '../utils/file';

const LINE_REGEXP = /(?:link_to|redirect_to|button_to|form_for|visit|url|path|href)/;
const WORD_REGEXP = /\w+/;

// Shortest word that may stand for a route helper. Below it every route in the
// app would match, which is noise rather than completion.
const MIN_WORD_LENGTH = 3;

const matchScore = (path1: string, path2: string): number => {
  const parts1 = path1.split('/');
  const parts2 = path2.split('/');

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

    if (LINE_REGEXP.test(line)) {
      return this.buildCompletionItems(document.uri);
    }

    // Outside a helper call, the word being typed has to look like a route helper
    // itself, as `users_pa` completing to `users_path`.
    const wordRange = document.getWordRangeAtPosition(position, WORD_REGEXP);
    const word = wordRange ? document.getText(wordRange) : '';

    if (!this.prefixesARouteHelper(word)) {
      return null;
    }

    return this.buildCompletionItems(document.uri, wordRange);
  }

  private prefixesARouteHelper(word: string): boolean {
    if (word.length < MIN_WORD_LENGTH) {
      return false;
    }

    return Array.from(this.routes.getAll().keys()).some(
      (prefix) => `${prefix}_path`.startsWith(word) || `${prefix}_url`.startsWith(word)
    );
  }

  private buildCompletionItems(currentUri: Uri, wordRange?: Range) {
    const currentController = toPosix(workspace.asRelativePath(currentUri)).replace(/app\/(?:controllers|views)\//, '');

    const rootPath = workspace.getWorkspaceFolder(currentUri)?.uri.fsPath || '';
    const itemsWithScore: { item: CompletionItem; score: number }[] = [];

    Array.from(this.routes.getAll()).forEach(([prefix, route]) => {
      const item = new CompletionItem(`${prefix}_path`, CompletionItemKind.Method);

      item.detail = buildRouteHelperDetails(route, rootPath);
      item.insertText = buildRouteHelperSnippet(prefix, route.params);
      // One item stands for both helpers (the snippet offers path|url), so the
      // filter has to recognize someone typing either of the two names.
      item.filterText = `${prefix}_path ${prefix}_url`;
      // Replace the word already typed instead of appending to it.
      item.range = wordRange;

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
