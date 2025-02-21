import { SnippetString, ProgressLocation, window, Position, workspace, Uri } from 'vscode';

import { Route } from './router_parser';
import Routes from './routes';

export const loadWithProgress = async (title: string, callback: () => Promise<void>): Promise<void> => {
  const progressOptions = {
    location: ProgressLocation.Window,
    title: title
  };

  await window.withProgress(progressOptions, () => callback());
};

export function buildRouteHelperSnippet(helperPrefix: string, params: string[]): SnippetString {
  const paramSnippets = params.map((param, index) => `\${${index + 2}:${param}}`).join(', ');
  const snippet = params.length > 0
    ? `${helperPrefix}_\${1|path,url|}(${paramSnippets})\$0`
    : `${helperPrefix}_\${1|path,url|}`;

  return new SnippetString(snippet);
}

export function buildRouteHelperDetails(route: Route, currentUri: string): string {
  const verbs = Array.from(route.verbs).join(', ');
  const actions = Array.from(route.actions).join(', ');

  return [
    verbs,
    `${route.uri}(.:format)\n`,
    `Controller: ${route.controller}`,
    `Actions: ${actions}`,
    route.source_location ? `Source: ${route.source_location.replace(currentUri, '')}` : ''
  ].join('\n');
}

export async function getActionPosition(controllerPath: Uri, action: string): Promise<Position | null> {
  const document = await workspace.openTextDocument(controllerPath);
  const regex = new RegExp(`^\\s*def\\s+${action}[;\\s]*(?:end)?$`);

  for (let index = 0; index < document.lineCount; index++) {
    const line = document.lineAt(index);

    if (regex.test(line.text)) {
      return new Position(index, 0);
    }
  }

  return null;
}
