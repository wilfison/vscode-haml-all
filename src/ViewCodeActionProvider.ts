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
    if (range.isSingleLine) {
      return null;
    }

    const relativePath = workspace.asRelativePath(document.uri);
    if (!relativePath.startsWith(path.join('app', 'views'))) {
      return null;
    }

    const action = new CodeAction('Create a partial from selection', CodeActionKind.RefactorExtract);
    action.command = {
      command: 'hamlAll.createPartialFromSelection',
      title: 'Create a partial from selection'
    };

    return [action];
  }
}

export async function createPartialFromSelection(): Promise<void> {
  const editor = window.activeTextEditor;

  if (!editor || editor.selection.isEmpty) {
    return;
  }

  const name = await window.showInputBox({ prompt: 'Input partial name:' });

  if (!name) {
    return;
  }

  // change vscode selection to whole line
  editor.selection = new Selection(
    editor.selection.start.with({ character: 0 }),
    editor.selection.end.with({ character: Number.MAX_VALUE })
  );

  const filePath = getPartialFilePath(editor.document.uri.path, name);
  const partialName = getPartialName(editor.document.uri, name);
  const uri = Uri.file(filePath);

  const [partialContent, indentation] = formatPartialContent(editor.document.getText(editor.selection));
  const renderText = `${indentation}= render('${partialName}')\n`;

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

function formatPartialContent(content: string): [string, string] {
  const lines = content.split('\n');

  if (lines.length === 0) {
    return [content, ''];
  }

  const firstLineWithContent = lines.findIndex(line => line.trim().length > 0);
  const firstLineIndentation = lines[firstLineWithContent].match(/^[\s\t]*/)?.[0] || '';

  console.log(firstLineIndentation);

  const formattedLines = lines.map(line => {
    return line.startsWith(firstLineIndentation) ? line.slice(firstLineIndentation.length) : line;
  });

  const newContent = formattedLines.join('\n');

  return [newContent, firstLineIndentation];
}