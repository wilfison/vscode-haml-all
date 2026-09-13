import { CodeAction, CodeActionKind, Diagnostic, TextDocument, WorkspaceEdit } from 'vscode';

export function fixSpaceInsideHashLiteralBraces(document: TextDocument, diagnostic: Diagnostic): CodeAction {
  const add = /Space inside [{}] missing/.test(diagnostic.message);

  const fix = new CodeAction(`${add ? 'Add' : 'Remove'} space inside hash literal braces`, CodeActionKind.QuickFix);
  fix.edit = new WorkspaceEdit();

  const content = document.getText(diagnostic.range);
  // Rebuild every hash from its trimmed body, so both sides are fixed in one pass.
  const fixed = content.replace(/\{([^{}]*)\}/g, (_, body: string) => {
    const inner = body.trim();
    return inner && add ? `{ ${inner} }` : `{${inner}}`;
  });

  if (fixed !== content) {
    fix.edit.replace(document.uri, diagnostic.range, fixed);
  }

  return fix;
}
