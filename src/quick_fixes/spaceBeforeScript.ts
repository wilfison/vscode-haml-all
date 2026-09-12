import { CodeAction, CodeActionKind, Diagnostic, TextDocument, WorkspaceEdit } from 'vscode';

export function fixSpaceBeforeScript(document: TextDocument, diagnostic: Diagnostic): CodeAction {
  const range = diagnostic.range;
  const text = document.getText(range);
  const fixedText = text.replace(/^[\s\t]*(=)/, '= ');

  const fix = new CodeAction('Fix SpaceBeforeScript', CodeActionKind.QuickFix);
  const edit = new WorkspaceEdit();

  edit.replace(document.uri, range, fixedText);
  fix.edit = edit;

  return fix;
}
