import { Diagnostic, TextDocument } from 'vscode';

import { fixStringLiterals } from './stringLiterals';

export const rubocopFixes = {
  'Style/StringLiterals': (document: TextDocument, diagnostic: Diagnostic) => fixStringLiterals(document, diagnostic),
};
