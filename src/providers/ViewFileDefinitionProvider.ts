import { TextDocument, Position, DefinitionProvider, DefinitionLink, Location, Range, Uri } from 'vscode';

import { getPartialName, resolvePartialFilePath } from '../utils/file';

export default class ViewFileDefinitionProvider implements DefinitionProvider {
  public async provideDefinition(document: TextDocument, position: Position, token: any): Promise<DefinitionLink[]> {
    const lineText = document.lineAt(position.line).text;

    // Check if the cursor is over the partial string
    const partialStringRange = this.getPartialStringRange(position, lineText);
    if (!partialStringRange) {
      return [];
    }

    const partialName = getPartialName(document, position);
    if (!partialName) {
      return [];
    }

    const filePaths = resolvePartialFilePath(partialName, document.fileName);

    if (filePaths.length === 0) {
      return [];
    }

    const definitionLinks: DefinitionLink[] = [];

    for (const filePath of filePaths) {
      const uri = Uri.file(filePath);
      const location = new Location(uri, new Range(new Position(0, 0), new Position(0, 0)));

      const definitionLink: DefinitionLink = {
        targetUri: uri,
        targetRange: location.range,
        targetSelectionRange: location.range,
        originSelectionRange: partialStringRange,
      };

      definitionLinks.push(definitionLink);
    }

    return definitionLinks;
  }

  private getPartialStringRange(position: Position, lineText: string): Range | null {
    if (!lineText.includes('render')) {
      return null;
    }

    // Regex to capture strings with single or double quotes after render
    const stringMatches = [...lineText.matchAll(/["']([^"']+)["']/g)];

    for (const match of stringMatches) {
      if (match.index === undefined) {
        continue;
      }

      const startIndex = match.index + 1; // +1 to skip the opening quote
      const endIndex = match.index + match[0].length - 1; // -1 to exclude the closing quote

      // Check if the cursor is inside the string
      if (position.character >= startIndex && position.character <= endIndex) {
        return new Range(new Position(position.line, startIndex), new Position(position.line, endIndex));
      }
    }

    return null;
  }
}
