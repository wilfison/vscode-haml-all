import { TextDocument, TextEdit, workspace, WorkspaceEdit } from 'vscode';

export async function autoCorrectAll(document: TextDocument): Promise<void> {
  await trailingWhitespace(document);
}

async function trailingWhitespace(document: TextDocument): Promise<void> {
  const edits: TextEdit[] = [];
  const lastLine = document.lineAt(document.lineCount - 1);
  let hasTrailingWhitespace = false;

  // Remove trailing whitespace from each line
  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    const trimmedText = line.text.replace(/\s+$/, '');

    if (line.text !== trimmedText) {
      edits.push(TextEdit.replace(line.range, trimmedText));
      hasTrailingWhitespace = true;
    }
  }

  // Ensure there is a blank line at the end of the file
  if (lastLine.text.trim() !== '') {
    edits.push(TextEdit.insert(lastLine.range.end, '\n'));
  }

  if (hasTrailingWhitespace || lastLine.text.trim() !== '') {
    const edit = new WorkspaceEdit();
    edit.set(document.uri, edits);

    await workspace.applyEdit(edit);
    await document.save();
  }
}
