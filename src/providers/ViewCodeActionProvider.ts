import {
  CodeActionProvider,
  TextDocument,
  Range,
  workspace,
  CodeAction,
  CodeActionKind,
  window,
  Uri,
  WorkspaceEdit,
  Position,
  Selection,
} from 'vscode';

import * as path from 'path';

import { fileExists } from '../utils/file';

export class ViewCodeActionProvider implements CodeActionProvider {
  public provideCodeActions(document: TextDocument, range: Range): CodeAction[] | null {
    const actions: (CodeAction | null)[] = [
      buildPartialAction(range),
      buildHtml2HamlAction(),
      buildWrapInConditionalAction(range),
      buildWrapInBlockAction(range),
    ];

    const codeActions = actions.filter((action) => action !== null) as CodeAction[];

    return codeActions.length > 0 ? codeActions : null;
  }
}

function buildHtml2HamlAction(): CodeAction | null {
  const html2HamlAction = new CodeAction('Convert to HAML', CodeActionKind.RefactorExtract);
  html2HamlAction.command = {
    command: 'hamlAll.html2Haml',
    title: 'HAML: Convert HTML to HAML',
  };

  return html2HamlAction;
}

function buildPartialAction(range: Range): CodeAction | null {
  if (range.isSingleLine) {
    return null;
  }

  const partialAction = new CodeAction('Create a partial from selection', CodeActionKind.RefactorExtract);
  partialAction.command = {
    command: 'hamlAll.createPartialFromSelection',
    title: 'Create a partial from selection',
  };

  return partialAction;
}

function buildWrapInConditionalAction(range: Range): CodeAction | null {
  const wrapAction = new CodeAction('Wrap in conditional', CodeActionKind.RefactorRewrite);
  wrapAction.command = {
    command: 'hamlAll.wrapInConditional',
    title: 'Wrap in conditional',
  };

  return wrapAction;
}

function buildWrapInBlockAction(range: Range): CodeAction | null {
  const wrapAction = new CodeAction('Wrap in a ruby block', CodeActionKind.RefactorRewrite);
  wrapAction.command = {
    command: 'hamlAll.wrapInBlock',
    title: 'Wrap in a ruby block',
  };

  return wrapAction;
}

const VIEWS_SEGMENT = '/app/views/';

/**
 * Cleans up the name the user typed, or returns null when it cannot be used.
 *
 * A "/" is kept so `shared/foo` can create `app/views/shared/_foo.html.haml`;
 * `.`/`..` segments and absolute paths are refused, since the name ends up in a
 * file path.
 */
export function sanitizePartialName(input: string): string | null {
  const trimmed = input.trim().replace(/\\/g, '/');

  if (!trimmed || trimmed.startsWith('/')) {
    return null;
  }

  const segments = trimmed.split('/').filter(Boolean);

  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return null;
  }

  const sanitized = segments.map((segment) => segment.replace(/[^a-zA-Z0-9_-]/g, '_'));
  const last = sanitized.length - 1;

  if (last < 0) {
    return null;
  }

  // Only the file name carries the partial's leading underscore, and we add it.
  sanitized[last] = sanitized[last].replace(/^_+/, '');

  return sanitized[last] ? sanitized.join('/') : null;
}

/**
 * Where a new partial goes and how `render` should reference it.
 *
 * A name with a "/" is a path under app/views; a bare name lands next to the
 * current document. documentPath is a `Uri.path`, i.e. POSIX on every platform.
 */
export function resolvePartialTarget(documentPath: string, name: string): { filePath: string; renderName: string } {
  const viewsIndex = documentPath.lastIndexOf(VIEWS_SEGMENT);

  // A .haml outside app/views has no view-relative name: keep it a sibling file.
  if (viewsIndex === -1) {
    return {
      filePath: path.posix.join(path.posix.dirname(documentPath), `_${path.posix.basename(name)}.html.haml`),
      renderName: name,
    };
  }

  const viewsRoot = documentPath.slice(0, viewsIndex + VIEWS_SEGMENT.length - 1);
  const currentDir = path.posix.dirname(documentPath.slice(viewsIndex + VIEWS_SEGMENT.length));

  const renderName = name.includes('/') ? name : path.posix.join(currentDir === '.' ? '' : currentDir, name);

  return {
    filePath: path.posix.join(viewsRoot, path.posix.dirname(renderName), `_${path.posix.basename(renderName)}.html.haml`),
    renderName,
  };
}

export async function createPartialFromSelection(): Promise<void> {
  const editor = window.activeTextEditor;

  if (!editor || editor.selection.isEmpty) {
    return;
  }

  const input = await window.showInputBox({ prompt: 'Input partial name:' });

  if (!input) {
    return;
  }

  const name = sanitizePartialName(input);

  if (!name) {
    window.showErrorMessage('Invalid partial name. Use letters, numbers, "_", "-" and "/" — no "..", no absolute path.');
    return;
  }

  const { filePath, renderName } = resolvePartialTarget(editor.document.uri.path, name);

  // createFile() fails silently on an existing file, so check first instead of
  // letting applyEdit return false with nothing to show for it.
  if (fileExists(filePath)) {
    window.showErrorMessage(`\`${renderName}\` already exists. Pick another name.`);
    return;
  }

  // change vscode selection to whole line
  editor.selection = new Selection(
    editor.selection.start.with({ character: 0 }),
    editor.selection.end.with({ character: Number.MAX_VALUE })
  );

  const uri = Uri.file(filePath);
  const [partialContent, renderText] = formatPartialContent(renderName, editor.document.getText(editor.selection));

  const edit = new WorkspaceEdit();
  edit.createFile(uri);
  edit.insert(uri, new Position(0, 0), partialContent);
  edit.replace(editor.document.uri, editor.selection, renderText);

  if (!(await workspace.applyEdit(edit))) {
    window.showErrorMessage(`Could not create \`${renderName}\`. See the "Haml" output for details.`);
  }
}

// Instance variables only: a word character or a second @ before the sigil means
// this is an email address or a class variable, not a local to extract.
const INSTANCE_VARIABLE_REGEX = /(?<![\w@])@[A-Za-z_]\w*/g;

export function globalVariableList(content: string): string[] {
  const globalVariables = content.match(INSTANCE_VARIABLE_REGEX) || [];
  const globalVariablesSet = new Set(globalVariables);

  // sort by length to replace correctly
  return Array.from(globalVariablesSet).sort((a, b) => b.length - a.length);
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatPartialVariables(globalVariables: string[], content: string): string {
  if (globalVariables.length === 0) {
    return content;
  }

  const globalVariablesKeys = globalVariables.map((variable) => `${variable.replace('@', '')}:`).join(', ');
  const newContent = globalVariables.reduce((acc, variable) => {
    // Right boundary: @user must not match inside @user_id.
    return acc.replace(new RegExp(`${escapeForRegex(variable)}(?![\\w])`, 'g'), variable.replace('@', ''));
  }, content);

  return `-# locals: (${globalVariablesKeys})\n\n${newContent}`;
}

function buildRenderText(partialName: string, globalVariables: string[]): string {
  if (globalVariables.length === 0) {
    return `= render('${partialName}')\n`;
  }

  const globalVariablesKeys = globalVariables
    .map((variable) => {
      return `${variable.replace('@', '')}: ${variable}`;
    })
    .join(', ');

  return `= render('${partialName}', ${globalVariablesKeys})\n`;
}

function formatPartialContent(partialName: string, content: string): [string, string] {
  const lines = content.split('\n');

  if (lines.length === 0) {
    return [content, ''];
  }

  const firstLineWithContent = lines.findIndex((line) => line.trim().length > 0);
  const firstLineIndentation = lines[firstLineWithContent].match(/^[\s\t]*/)?.[0] || '';

  const formattedLines = lines.map((line) => {
    return line.startsWith(firstLineIndentation) ? line.slice(firstLineIndentation.length) : line;
  });

  const globalVariables = globalVariableList(content);
  const renderText = `${firstLineIndentation}${buildRenderText(partialName, globalVariables)}`;

  let newContent = formattedLines.join('\n');
  newContent = formatPartialVariables(globalVariables, newContent);
  newContent = newContent.trim();
  newContent += '\n';

  return [newContent, renderText];
}

export async function wrapContentInBlock(block: string): Promise<void> {
  const editor = window.activeTextEditor;

  if (!editor) {
    return;
  }

  // Expand the selection to full lines (an empty selection becomes its line).
  const selection = new Selection(
    editor.selection.start.with({ character: 0 }),
    editor.selection.end.with({ character: Number.MAX_VALUE })
  );

  const selectedText = editor.document.getText(selection);
  const lines = selectedText.split('\n');

  if (lines.length === 0) {
    return;
  }

  // Get the indentation of the first non-empty line
  const firstLineWithContent = lines.findIndex((line) => line.trim().length > 0);
  if (firstLineWithContent === -1) {
    return;
  }

  const baseIndentation = lines[firstLineWithContent].match(/^[\s\t]*/)?.[0] || '';

  // Add extra indentation to all lines (HAML uses 2 spaces by default)
  const indentedLines = lines.map((line, index) => {
    if (line.trim().length === 0) {
      return line; // Keep empty lines as they are
    }
    // Only add indentation if this is not the first line or if it already has the base indentation
    if (index === firstLineWithContent || line.startsWith(baseIndentation)) {
      return `  ${line}`; // Add 2 spaces of indentation
    }
    return `  ${baseIndentation}${line.trimStart()}`; // Normalize and add indentation
  });

  // Create the wrapped content with proper HAML conditional syntax
  const wrappedContent = `${baseIndentation}${block}\n${indentedLines.join('\n')}`;

  const edit = new WorkspaceEdit();
  edit.replace(editor.document.uri, selection, wrappedContent);

  await workspace.applyEdit(edit);

  // Optionally, move the cursor to the 'condition' part for easy editing. And select it.
  const conditionPosition = new Position(selection.start.line, baseIndentation.length);
  editor.selection = new Selection(conditionPosition, conditionPosition.translate(0, block.length));
  editor.revealRange(new Range(conditionPosition, conditionPosition));
}
