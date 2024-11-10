import { CodeAction, CodeActionKind, Diagnostic, Range, TextDocument, Uri, WorkspaceEdit } from 'vscode';

const DOUBLE_QUOTE_REGEX = /("[^"'#\n]+")/g;
const SINGLE_QUOTE_REGEX = /('[^"'\n]+')/g;

export function fixStringLiterals(document: TextDocument, diagnostic: Diagnostic): CodeAction | null {
  const codeAction = buildCodeAction(document.getText(diagnostic.range), document.uri, diagnostic, 'Autocorrect');

  return codeAction;
}

export function fixAllStringLiterals(document: TextDocument, diagnostics: Diagnostic[]): CodeAction | null {
  const diagnostic = diagnostics.find((d) => d.message.startsWith('Style/StringLiterals:')) as Diagnostic;

  if (!diagnostic) {
    return null;
  }

  const content = document.getText();
  const allFileRange = document.validateRange(new Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE));
  const codeAction = buildCodeAction(content, document.uri, { ...diagnostic, range: allFileRange }, 'Autocorrect all occurrences');

  return codeAction;
}

function buildCodeAction(content: string, uri: Uri, diagnostic: Diagnostic, action: string): CodeAction | null {
  const [rule, message] = diagnostic.message.split(':');

  const preferSingleQuoted = message.includes('Prefer single-quoted');
  const quote = preferSingleQuoted ? '\'' : '"';
  const regex = preferSingleQuoted ? DOUBLE_QUOTE_REGEX : SINGLE_QUOTE_REGEX;
  const offenses = content.match(regex);

  if (!offenses || offenses.length === 0) {
    return null;
  }

  const fix = new CodeAction(`${action} ${rule}`, CodeActionKind.QuickFix);
  const edit = new WorkspaceEdit();

  offenses.forEach((offense) => {
    const newContent = content.replace(offense, `${quote}${offense.slice(1, -1)}${quote}`);
    edit.replace(uri, diagnostic.range, newContent);
  });

  fix.edit = edit;

  return fix;
}
