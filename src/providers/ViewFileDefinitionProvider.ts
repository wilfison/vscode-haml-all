import {
  TextDocument,
  Position,
  DefinitionProvider,
  workspace,
  DefinitionLink,
  Location,
  Range,
  Uri
} from 'vscode';

import { getPartialName, resolvePartialFilePath } from '../ultils/file';

export default class ViewFileDefinitionProvider implements DefinitionProvider {
  public async provideDefinition(document: TextDocument, position: Position, token: any): Promise<DefinitionLink[]> {
    const partialName = getPartialName(document, position);
    if (!partialName) {
      return [];
    }

    const filePath = resolvePartialFilePath(partialName, document.fileName);
    const uri = Uri.file(filePath);
    const originSelectionRange = document.getWordRangeAtPosition(position, /[\w/]+/);
    const location = new Location(uri, new Range(new Position(0, 0), new Position(0, 0)));

    const definitionLink: DefinitionLink = {
      targetUri: uri,
      targetRange: location.range,
      targetSelectionRange: location.range,
      originSelectionRange: originSelectionRange
    };

    return [definitionLink];
  }
}
