import { CodeAction, CodeActionKind, Diagnostic, TextDocument, WorkspaceEdit } from 'vscode';

export function fixSpaceInsideHashLiteralBraces(document: TextDocument, diagnostic: Diagnostic): CodeAction {
  const fixType = diagnostic.message.match(/Space inside [\{\}] missing/) ? 'Add' : 'Remove';

  const fix = new CodeAction(`${fixType} space inside hash literal braces`, CodeActionKind.QuickFix);
  const edit = new WorkspaceEdit();

  const content = document.getText(diagnostic.range);
  const hashRegex = /(\{[^\{]*\})/g;
  const hashes = content.match(hashRegex);

  if (hashes) {
    hashes.forEach((hash) => {
      const fixedHash = handleHashSpace(fixType, content, hash);
      edit.replace(document.uri, diagnostic.range, fixedHash);
    });
  }

  fix.edit = edit;

  return fix;
}

function handleHashSpace(fixType: string, content: string, hash: string): string {
  let newContent = content;

  if (fixType === 'Add') {
    if (hash[1] !== ' ') {
      newContent = newContent.replace(hash, `{ ${hash.slice(1)}`);
    }
    if (hash[hash.length - 2] !== ' ') {
      newContent = newContent.replace(hash.slice(1), `${hash.slice(1, -1)} }`);
    }

    return newContent;
  }

  if (hash[1] === ' ') {
    newContent = newContent.replace(hash, `{${hash.slice(2)}`);
  }
  if (hash[hash.length - 2] === ' ') {
    newContent = newContent.replace(hash.slice(1), `${hash.slice(1, -2)}}`);
  }

  return newContent;
}
