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

export default class ViewFileDefinitionProvider implements DefinitionProvider {
  private static readonly PARTIAL_EXPLICIT_REGEX = /partial\:\s*["':\/\-_]?([\/\-_\w]+)/;
  private static readonly PARTIAL_IMPLICIT_REGEX = /["':\/\-_]([\/\-_\w]+)/;

  public async provideDefinition(document: TextDocument, position: Position, token: any): Promise<DefinitionLink[]> {
    const partialName = this.getPartialName(document, position);
    if (!partialName) {
      return [];
    }

    const filePath = this.resolvePartialFilePath(partialName, document.fileName);
    const uri = Uri.file(filePath);
    const originSelectionRange = document.getWordRangeAtPosition(position, /[\w/]+/);
    const location = new Location(uri, new Range(new Position(0, 0), new Position(0, 0)));

    console.log('File Location: ', filePath);

    const definitionLink: DefinitionLink = {
      targetUri: uri,
      targetRange: location.range,
      targetSelectionRange: location.range,
      originSelectionRange: originSelectionRange
    };

    return [definitionLink];
  }

  private getPartialName(document: TextDocument, position: Position): string {
    const lineText = document.lineAt(position.line).text;

    return this.extractPartialNameFromLine(lineText);
  }

  private extractPartialNameFromLine(lineText: string): string {
    if (!lineText.includes('render')) {
      return '';
    }

    const cleanedLineText = lineText.split(' ').filter(Boolean).join(' ');
    const afterRender = cleanedLineText.split(/render\(|render\ |render\: /)[1];
    const partialMatch = afterRender.match(ViewFileDefinitionProvider.PARTIAL_EXPLICIT_REGEX) ||
      afterRender.match(ViewFileDefinitionProvider.PARTIAL_IMPLICIT_REGEX);

    if (!partialMatch) {
      return '';
    }

    const partialName = partialMatch[1].replace(/["'()]/g, '');
    return this.formatPartialName(partialName);
  }

  private formatPartialName(partialName: string): string {
    return partialName.split('/').map((item, index, array) => {
      return index === array.length - 1 ? `_${item}` : item;
    }).join('/');
  }

  private resolvePartialFilePath(partialName: string, currentFileName: string): string {
    const fileExtension = currentFileName.substring(currentFileName.indexOf('.'));

    if (partialName.includes('/')) {
      return `${this.getWorkspaceRoot()}/app/views/${partialName}${fileExtension}`;
    }

    const currentDirectory = currentFileName.substring(0, currentFileName.lastIndexOf('/'));
    return `${currentDirectory}/${partialName}${fileExtension}`;
  }

  private getWorkspaceRoot(): string {
    return workspace.workspaceFolders?.[0]?.uri.path || '';
  }
}
