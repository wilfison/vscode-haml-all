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
  Selection
} from 'vscode';

import * as path from 'path';

export class ViewCodeActionProvider implements CodeActionProvider {
  public provideCodeActions(document: TextDocument, range: Range): CodeAction[] | null {
    const actions: (CodeAction | null)[] = [
      buildPartialAction(range),
      buildHtml2HamlAction(),
      buildWrapInConditionalAction(range)
    ];

    const codeActions = actions.filter(action => action !== null) as CodeAction[];

    return codeActions.length > 0 ? codeActions : null;
  }
}

function buildHtml2HamlAction(): CodeAction | null {
  const html2HamlAction = new CodeAction('Convert to HAML', CodeActionKind.RefactorExtract);
  html2HamlAction.command = {
    command: 'hamlAll.html2Haml',
    title: 'HAML: Convert HTML to HAML'
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
    title: 'Create a partial from selection'
  };

  return partialAction;
}

function buildWrapInConditionalAction(range: Range): CodeAction | null {
  if (range.isEmpty) {
    return null;
  }

  const wrapAction = new CodeAction('Wrap in conditional', CodeActionKind.RefactorRewrite);
  wrapAction.command = {
    command: 'hamlAll.wrapInConditional',
    title: 'Wrap in conditional'
  };

  return wrapAction;
}

export async function createPartialFromSelection(): Promise<void> {
  const editor = window.activeTextEditor;

  if (!editor || editor.selection.isEmpty) {
    return;
  }

  let name = await window.showInputBox({ prompt: 'Input partial name:' });

  if (!name) {
    return;
  }

  // sanitize name
  name = name.trim().replace(/^_*/, '').replaceAll(/[^a-zA-Z0-9_]/g, '_');

  // change vscode selection to whole line
  editor.selection = new Selection(
    editor.selection.start.with({ character: 0 }),
    editor.selection.end.with({ character: Number.MAX_VALUE })
  );

  const filePath = getPartialFilePath(editor.document.uri.path, name);
  const partialName = getPartialName(editor.document.uri, name);
  const uri = Uri.file(filePath);

  const [partialContent, renderText] = formatPartialContent(partialName, editor.document.getText(editor.selection));

  const edit = new WorkspaceEdit();
  edit.createFile(uri);
  edit.insert(uri, new Position(0, 0), partialContent);
  edit.replace(editor.document.uri, editor.selection, renderText);

  await workspace.applyEdit(edit);
}

function getPartialFilePath(documentPath: string, name: string): string {
  return path.join(path.dirname(documentPath), `_${name}.html.haml`);
}

function getPartialName(documentUri: Uri, name: string): string {
  const relativePath = workspace.asRelativePath(documentUri);
  const [, , ...parts] = path.dirname(relativePath).split(path.sep);

  return path.join(...parts, name);
}

function globalVariableList(content: string): string[] {
  const globalVariables = content.match(/(@[\w\d_]*)/g) || [];
  const globalVariablesSet = new Set(globalVariables);

  // sort by length to replace correctly
  return Array.from(globalVariablesSet).sort((a, b) => b.length - a.length);
}

function formatPartialVariables(globalVariables: string[], content: string): string {
  if (globalVariables.length === 0) {
    return content;
  }

  const globalVariablesKeys = globalVariables.map(variable => `${variable.replace('@', '')}:`).join(', ');
  const newContent = globalVariables.reduce((acc, variable) => {
    return acc.replace(new RegExp(variable, 'g'), variable.replace('@', ''));
  }, content);

  return `-# locals: (${globalVariablesKeys})\n\n${newContent}`;
}

function buildRenderText(partialName: string, globalVariables: string[]): string {
  if (globalVariables.length === 0) {
    return `= render('${partialName}')\n`;
  }

  const globalVariablesKeys = globalVariables.map((variable) => {
    return `${variable.replace('@', '')}: ${variable}`;
  }).join(', ');

  return `= render('${partialName}', ${globalVariablesKeys})\n`;
}

function formatPartialContent(partialName: string, content: string): [string, string] {
  const lines = content.split('\n');

  if (lines.length === 0) {
    return [content, ''];
  }

  const firstLineWithContent = lines.findIndex(line => line.trim().length > 0);
  const firstLineIndentation = lines[firstLineWithContent].match(/^[\s\t]*/)?.[0] || '';

  const formattedLines = lines.map(line => {
    return line.startsWith(firstLineIndentation) ? line.slice(firstLineIndentation.length) : line;
  });

  const globalVariables = globalVariableList(content);
  const renderText = buildRenderText(partialName, globalVariables);

  let newContent = formattedLines.join('\n');
  newContent = formatPartialVariables(globalVariables, newContent);
  newContent = newContent.trim();
  newContent += '\n';

  return [newContent, renderText];
}

export async function wrapInConditional(): Promise<void> {
  const editor = window.activeTextEditor;

  if (!editor || editor.selection.isEmpty) {
    return;
  }

  const condition = await window.showInputBox({
    prompt: 'Enter condition (e.g., user.present?, @items.any?, etc.):',
    placeHolder: 'user.present?'
  });

  if (!condition) {
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);
  const lines = selectedText.split('\n');

  if (lines.length === 0) {
    return;
  }

  // Get the indentation of the first non-empty line
  const firstLineWithContent = lines.findIndex(line => line.trim().length > 0);
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
  const wrappedContent = `${baseIndentation}- if ${condition}\n${indentedLines.join('\n')}`;

  const edit = new WorkspaceEdit();
  edit.replace(editor.document.uri, selection, wrappedContent);

  await workspace.applyEdit(edit);
}
