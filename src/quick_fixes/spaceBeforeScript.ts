import { CodeAction, CodeActionKind, Diagnostic, TextDocument, WorkspaceEdit } from 'vscode';

export function fixSpaceBeforeScript(document: TextDocument, diagnostic: Diagnostic): CodeAction | null {
  if (diagnostic.code !== 'SpaceBeforeScript') {
    return null;
  }

  const range = diagnostic.range;
  const text = document.getText(range);
  const fixedText = text.replace(/^[\s\t]*(=)/, '= ');

  const fix = new CodeAction(`Fix ${diagnostic.code}`, CodeActionKind.QuickFix);
  const edit = new WorkspaceEdit();

  edit.replace(document.uri, range, fixedText);
  fix.edit = edit;

  return fix;
}
