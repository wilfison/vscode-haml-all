import { Diagnostic, TextDocument } from 'vscode';
import { stringLiterals } from './stringLiterals';

export const rubocopFixes = {
  'Style/StringLiterals': (document: TextDocument, diagnostic: Diagnostic) => stringLiterals(document, diagnostic),
};
