import fs from 'node:fs';
import path from 'node:path';
import { Position, Range, TextDocument, Uri, window, workspace } from 'vscode';

const PARTIAL_EXPLICIT_REGEX = /partial\:\s*["':\/\-_]?([\/\-_\w]+)/;
const PARTIAL_IMPLICIT_REGEX = /["':\/\-_]([\/\-_\w]+)/;

/**
 * Normalizes a path to `/` separators. `Uri.path` and `workspace.asRelativePath`
 * already use `/` everywhere, but `fsPath`/`document.fileName` use `\` on
 * Windows — and these paths are split, compared and even inserted into HAML, so
 * they all have to agree on one separator. Idempotent.
 */
export function toPosix(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

export function openFile(filePath: string, lineNumber: number): void {
  const uri = Uri.file(filePath);

  workspace.openTextDocument(uri).then((document) => {
    window.showTextDocument(document, {
      selection: new Range(lineNumber, 0, lineNumber, 0),
    });
  });
}

export function isPartialDocument(document: TextDocument): boolean {
  if (document.languageId !== 'haml') {
    return false;
  }

  return (toPosix(document.fileName).split('/').pop() || '')?.startsWith('_');
}

export function getWorkspaceRoot(): string {
  return workspace.workspaceFolders?.[0]?.uri.fsPath || '';
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

  // The line only *contains* "render": it may be `@rendered_count`,
  // `render_to_string(x)` or a comment, none of which produce a second part.
  const afterRender = cleanedLineText.split(/render\(|render\ |render\: /)[1] || '';
  const partialMatch = afterRender.match(PARTIAL_EXPLICIT_REGEX) || afterRender.match(PARTIAL_IMPLICIT_REGEX);

  if (!partialMatch) {
    return '';
  }

  const partialName = partialMatch[1].replace(/["'()]/g, '');
  return formatPartialName(partialName);
}

export function formatPartialName(partialName: string): string {
  return partialName
    .split('/')
    .map((item, index, array) => {
      return index === array.length - 1 ? `_${item}` : item;
    })
    .join('/');
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

  findFileExistsInWorkspace(workspacePath, partialName, fileExtensions).forEach((filePath) => {
    if (!possibleFileLocations.includes(filePath)) {
      possibleFileLocations.push(filePath);
    }
  });

  return possibleFileLocations;
}

export function resolvePartialFilePath(partialName: string, fileBaseName: string): string[] {
  // fileBaseName is a document.fileName, i.e. native separators on Windows.
  const basePath = toPosix(fileBaseName);
  const workspaceBasePath = basePath.substring(0, basePath.indexOf('/views/') + 6);
  const fileExtensions = ['.html.haml', '.haml', '.html.erb', '.erb'];

  if (partialName.includes('/')) {
    return findFileInProjects(partialName, workspaceBasePath, fileExtensions);
  }

  const possibleFileLocations: string[] = [];
  const viewBasePath = basePath.split('/').slice(0, -1).join('/');

  findFileExistsInWorkspace(viewBasePath, partialName, fileExtensions).forEach((filePath) => {
    if (!possibleFileLocations.includes(filePath)) {
      possibleFileLocations.push(filePath);
    }
  });

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
