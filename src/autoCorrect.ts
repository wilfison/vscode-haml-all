import { Range, TextDocument, TextEdit, workspace, WorkspaceEdit } from 'vscode';

export async function autoCorrectAll(document: TextDocument): Promise<void> {
  await fixWhitespace(document);

  // save the document
  await document.save();
}

async function fixWhitespace(document: TextDocument): Promise<void> {
  const text = document.getText();
  const edits: TextEdit[] = [];

  // Remove trailing whitespace and multiple blank lines
  const fixedText = text
    .split('\n')
    .map(line => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{2,}/g, '\n\n');

  // Add a blank line at the end if not present
  const finalText = fixedText.endsWith('\n') ? fixedText : fixedText + '\n';

  if (finalText !== text) {
    const fullRange = new Range(
      document.positionAt(0),
      document.positionAt(text.length)
    );
    edits.push(TextEdit.replace(fullRange, finalText));
  }

  if (edits.length > 0) {
    const workspaceEdit = new WorkspaceEdit();
    workspaceEdit.set(document.uri, edits);
    await workspace.applyEdit(workspaceEdit);
  }
}
