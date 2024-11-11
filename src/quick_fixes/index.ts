import { Diagnostic, TextDocument } from 'vscode';

import { fixStringLiterals } from './stringLiterals';
import { fixSpaceBeforeScript } from './spaceBeforeScript';

export const rubocopFixes = {
  'Style/StringLiterals': (document: TextDocument, diagnostic: Diagnostic) => fixStringLiterals(document, diagnostic),
};

export const hamlLintFixes = {
  'SpaceBeforeScript': (document: TextDocument, diagnostic: Diagnostic) => fixSpaceBeforeScript(document, diagnostic),
};
