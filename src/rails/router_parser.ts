const RAW_LINE_REMOVE = /^.*\|\s?/;
const ROW_LINE_URI = /^.*\|\s?(.*)(?:\(\.:format\))/;
const PARAM_REGEXP = /^:\w+$/;

export type BaseRoute = {
  prefix: string;
  verb: string;
  uri: string;
  uri_params: string[];
  controller: string;
  action: string;
  source_location: string;
};

export type Route = {
  prefix: string;
  verbs: Set<string>;
  actions: Set<string>;
  uri: string;
  params: string[];
  source_location: string;
  controller: string;
};

function parseRawBlock(block: string, lastRoute: BaseRoute): BaseRoute {
  const [prefix, verb, uriLine, controllerLine, source] = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const [controller, action] = controllerLine.replace(RAW_LINE_REMOVE, '').split('#');

  const uri = uriLine.match(ROW_LINE_URI)?.[1] || '';
  const uri_params = uri.split('/').filter((part) => part.match(PARAM_REGEXP));

  return {
    prefix: prefix.replace(RAW_LINE_REMOVE, '') || lastRoute.prefix,
    verb: verb.replace(RAW_LINE_REMOVE, ''),
    uri,
    uri_params,
    controller,
    action,
    source_location: source?.replace(RAW_LINE_REMOVE, '') || '',
  };
}

function formatObjectRoutes(output: string): BaseRoute[] {
  const routeBlocks = output.split(/--\[\sRoute\s\d+\s]-+\n/).filter(Boolean);
  const routes: BaseRoute[] = [];

  routeBlocks.forEach((block, index) => {
    const route = parseRawBlock(block, routes[index - 1] || {});

    routes.push(route);
  });

  return routes;
}

function buildNewRoute(): Route {
  return {
    prefix: '',
    verbs: new Set(),
    actions: new Set(),
    uri: '',
    params: [],
    controller: '',
    source_location: '',
  };
}

export function parseRoutes(output: string): Map<string, Route> {
  const rawRoutes = formatObjectRoutes(output);

  const routes = rawRoutes.reduce((acc, route) => {
    const prefix = route.prefix;
    const controllerRoute = acc.get(prefix) || buildNewRoute();

    controllerRoute.verbs.add(route.verb);
    controllerRoute.actions.add(route.action);
    controllerRoute.uri = route.uri;
    controllerRoute.params = route.uri_params;
    controllerRoute.controller = route.controller;
    controllerRoute.source_location = route.source_location;
    controllerRoute.prefix = prefix;

    acc.set(prefix, controllerRoute);

    return acc;
  }, new Map<string, Route>());

  return routes;
}
