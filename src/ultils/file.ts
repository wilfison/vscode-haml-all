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

function findFileExistsInWorkspace(workspacePath: string, partial: string, fileExtensions: string[]): string[] {
  const possibleFileLocations: string[] = [];

  for (const extension of fileExtensions) {
    const filePath = `${workspacePath}/${partial}${extension}`;

    if (fs.existsSync(filePath)) {
      possibleFileLocations.push(filePath);
    }
  }

  return possibleFileLocations;
}

function findFileInProjects(partialName: string, workspacePath: string, fileExtensions: string[]): string[] {
  const workspaceFolders = workspace.workspaceFolders;

  if (workspaceFolders === undefined || workspaceFolders.length === 0) {
    return [];
  }

  const possibleFileLocations: string[] = [];

  findFileExistsInWorkspace(workspacePath, partialName, fileExtensions)
    .forEach((filePath) => {
      if (!possibleFileLocations.includes(filePath)) {
        possibleFileLocations.push(filePath);
      }
    }
    );

  return possibleFileLocations;
}

export function resolvePartialFilePath(partialName: string, fileBaseName: string): string[] {
  const workspaceBasePath = fileBaseName.substring(0, fileBaseName.indexOf('/views/') + 6);
  const fileExtensions = ['.html.haml', '.haml', '.html.erb', '.erb'];

  if (partialName.includes('/')) {
    return findFileInProjects(partialName, workspaceBasePath, fileExtensions);
  }

  const possibleFileLocations: string[] = [];
  const viewBasePath = fileBaseName.split('/').slice(0, -1).join('/');

  findFileExistsInWorkspace(viewBasePath, partialName, fileExtensions)
    .forEach((filePath) => {
      if (!possibleFileLocations.includes(filePath)) {
        possibleFileLocations.push(filePath);
      }
    }
    );

  return possibleFileLocations;
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
