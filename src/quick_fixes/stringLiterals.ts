import { CodeAction, CodeActionKind, Diagnostic, TextDocument, WorkspaceEdit } from 'vscode';

const DOUBLE_QUOTE_REGEX = /("[^"'#\n]+")/g;
const SINGLE_QUOTE_REGEX = /('[^"'\n]+')/g;

export function stringLiterals(document: TextDocument, diagnostic: Diagnostic): CodeAction[] {
  const [rule, message] = diagnostic.message.split(':');
  const content = document.getText(diagnostic.range);

  const preferSingleQuoted = message.includes('Prefer single-quoted');
  const quote = preferSingleQuoted ? '\'' : '"';
  const offenses = content.match(preferSingleQuoted ? DOUBLE_QUOTE_REGEX : SINGLE_QUOTE_REGEX);

  if (!offenses || offenses.length === 0) {
    return [];
  }

  const fix = new CodeAction(`Autocorrect ${rule}`, CodeActionKind.QuickFix);
  fix.edit = new WorkspaceEdit();

  offenses.forEach((offense) => {
    fix.edit?.replace(document.uri, diagnostic.range, content.replace(offense, `${quote}${offense.slice(1, -1)}${quote}`));
  });

  return [fix];
}