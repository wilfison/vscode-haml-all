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
};

export const hamlLintFixes = {
  'SpaceBeforeScript': (document: TextDocument, diagnostic: Diagnostic) => fixSpaceBeforeScript(document, diagnostic),
};
