import { CodeAction, Diagnostic, TextDocument } from 'vscode';

import { fixStringLiterals } from './stringLiterals';
import { fixSpaceBeforeScript } from './spaceBeforeScript';
import { fixSpaceInsideHashLiteralBraces } from './spaceInsideHashLiteralBraces';

export function rubocopFix(rule: string, document: TextDocument, diagnostic: Diagnostic): CodeAction | null {
  switch (rule) {
    case 'Style/StringLiterals':
      return fixStringLiterals(document, diagnostic);
    case 'Layout/SpaceInsideHashLiteralBraces':
      return fixSpaceInsideHashLiteralBraces(document, diagnostic);
    default:
      return null;
  }
}

export function hamlLintFixes(rule: string, document: TextDocument, diagnostic: Diagnostic): CodeAction | null {
  switch (rule) {
    case 'SpaceBeforeScript':
      return fixSpaceBeforeScript(document, diagnostic);
    default:
      return null;
  }
}
