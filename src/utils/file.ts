import fs from 'node:fs';
import path from 'node:path';
import { Position, Range, TextDocument, Uri, window, workspace } from 'vscode';

import { getPartialIndex, resolvePartial } from '../rails/partialIndex';

const PARTIAL_EXPLICIT_REGEX = /partial\:\s*["':\/\-_]?([\/\-_\w]+)/;
const PARTIAL_IMPLICIT_REGEX = /["':\/\-_]([\/\-_\w]+)/;
// `render @user` / `render(user)`: the partial is named by an object or a
// collection, not by a string.
const PARTIAL_OBJECT_REGEX = /^@?([a-z_]\w*)/;

/**
 * Normalizes a path to `/` separators, idempotently. `Uri.path` already uses `/`, but
 * `fsPath` uses `\` on Windows, and these paths get compared and inserted into HAML.
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
  const partialMatch =
    afterRender.match(PARTIAL_EXPLICIT_REGEX) ||
    afterRender.match(PARTIAL_IMPLICIT_REGEX) ||
    afterRender.match(PARTIAL_OBJECT_REGEX);

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

/**
 * The files a `render` on this line points at, best match first.
 *
 * @param partialName - as written, with the leading underscore added
 * @param fileBaseName - a `document.fileName`, i.e. native separators on Windows
 */
export async function resolvePartialFilePath(partialName: string, fileBaseName: string): Promise<string[]> {
  return resolvePartial(await getPartialIndex(), partialName, fileBaseName);
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// Signature help asks for these on every keystroke, and the answer only changes
// when the partial does.
const localsCache = new Map<string, { mtimeMs: number; locals: string }>();

// local keys declared in stric partials comment
export function fileStringLocals(filePath: string): string {
  let mtimeMs: number;

  try {
    mtimeMs = fs.statSync(filePath).mtimeMs;
  } catch (error) {
    return '';
  }

  const cached = localsCache.get(filePath);
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached.locals;
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const localsMatch = fileContent.match(/locals\:\s*\((.*)\)/);
  const locals = localsMatch ? localsMatch[1] : '';

  localsCache.set(filePath, { mtimeMs, locals });

  return locals;
}
