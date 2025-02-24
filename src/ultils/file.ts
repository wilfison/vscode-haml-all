import fs from 'node:fs';
import { Position, TextDocument, workspace } from 'vscode';

const PARTIAL_EXPLICIT_REGEX = /partial\:\s*["':\/\-_]?([\/\-_\w]+)/;
const PARTIAL_IMPLICIT_REGEX = /["':\/\-_]([\/\-_\w]+)/;

export function getWorkspaceRoot(): string {
  return workspace.workspaceFolders?.[0]?.uri.path || '';
}

export function getPartialName(document: TextDocument, position: Position): string {
  const lineText = document.lineAt(position.line).text;

  return extractPartialNameFromLine(lineText);
}

export function extractPartialNameFromLine(lineText: string): string {
  if (!lineText.includes('render')) {
    return '';
  }

  const cleanedLineText = lineText.split(' ').filter(Boolean).join(' ');
  const afterRender = cleanedLineText.split(/render\(|render\ |render\: /)[1];
  const partialMatch = afterRender.match(PARTIAL_EXPLICIT_REGEX) ||
    afterRender.match(PARTIAL_IMPLICIT_REGEX);

  if (!partialMatch) {
    return '';
  }

  const partialName = partialMatch[1].replace(/["'()]/g, '');
  return formatPartialName(partialName);
}

export function formatPartialName(partialName: string): string {
  return partialName.split('/').map((item, index, array) => {
    return index === array.length - 1 ? `_${item}` : item;
  }).join('/');
}

export function resolvePartialFilePath(partialName: string, fileBaseName: string): string {
  const fileExtension = fileBaseName.substring(fileBaseName.indexOf('.'));

  if (partialName.includes('/')) {
    return `${getWorkspaceRoot()}/app/views/${partialName}${fileExtension}`;
  }

  const currentDirectory = fileBaseName.substring(0, fileBaseName.lastIndexOf('/'));

  return `${currentDirectory}/${partialName}${fileExtension}`;
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// local keys declared in stric partials comment
export function fileStringLocals(filePath: string): string {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const localsMatch = fileContent.match(/locals\:\s*\((.*)\)/);

  return localsMatch ? localsMatch[1] : '';
}
