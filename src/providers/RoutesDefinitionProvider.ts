import { DefinitionProvider, TextDocument, Location, Position, workspace, Uri, Range } from 'vscode';

import Routes from '../rails/routes';
import { getActionPosition } from '../rails/utils';

const HELPER_METHOD_REGEXP = /\w+_(?:path|url)/;

export default class RoutesDefinitionProvider implements DefinitionProvider {
  constructor(private routes: Routes) {}

  public async provideDefinition(document: TextDocument, position: Position) {
    const range = document.getWordRangeAtPosition(position, HELPER_METHOD_REGEXP);
    if (!range) {
      return;
    }

    const prefix = this.extractPrefix(document, range);
    const route = this.routes.get(prefix);
    if (!route) {
      return;
    }

    const controllerPaths = await this.findControllerPaths(route.controller);
    if (controllerPaths.length < 1) {
      return;
    }

    return this.getLocations(controllerPaths[0], route.actions);
  }

  private extractPrefix(document: TextDocument, range: Range): string {
    return document.getText(range).replace(/_(?:path|url)$/, '');
  }

  private async findControllerPaths(controller: string) {
    return workspace.findFiles(`app/controllers/${controller}_controller.rb`);
  }

  private async getLocations(uri: Uri, actions: Set<string>): Promise<Location[]> {
    const promises = Array.from(actions).map(async (action) => {
      const position = await getActionPosition(uri, action);

      if (!position) {
        return;
      }

      return new Location(uri, position);
    });

    const promisedLocations = await Promise.all(promises);
    const locations = promisedLocations.filter(Boolean) as Location[];

    return locations;
  }
}
