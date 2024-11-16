import { SnippetString, Uri, ProgressLocation, window } from 'vscode';
import { Route } from './router_parser';

import Routes from './routes';

export const refreshRoutes = (routes: Routes) => {
  const progressOptions = {
    location: ProgressLocation.Window,
    title: 'Loading rails routes'
  };

  window.withProgress(progressOptions, () => routes.load());
};

export function buildRouteHelperSnippet(helperPrefix: string, params: string[]) {
  let snippet = `${helperPrefix}_\${1|path,url|}`;

  if (params.length > 0) {
    const args = params.map((param, index) => `\${${index + 2}:${param}}`);

    snippet = `${snippet}(${args.join(', ')})\$0`;
  }

  return new SnippetString(snippet);
}

export function buildRouteHelperDetails(route: Route, currentUri: string) {
  let verbs = Array.from(route.verbs).join(', ');
  let actions = Array.from(route.actions).join(', ');

  return [
    verbs,
    `${route.uri}(.:format)\n`,
    `Controller: ${route.controller}`,
    `Actions: ${actions}`,
    `Source: ${route.source_location.replace(currentUri, '')}`
  ].join('\n');
}
