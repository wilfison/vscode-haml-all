import { Diagnostic, DiagnosticSeverity, Position, Range, TextDocument, Uri } from 'vscode';
import { LinterOffense } from '../types';
import { hamlCopUrl } from '../utils/uris';

const RUBOCOP_COP_NAME_REGEX = /([\w\/]*):/;

function rubocopCopUrl(copName: string): Uri {
  const copModule = copName.toLowerCase().split('/')[0];
  const copAnchor = copName.toLowerCase().replace(/[^a-z0-9]+/g, '');

  return Uri.parse(`https://docs.rubocop.org/rubocop/cops_${copModule}.html#${copAnchor}`);
}

function parseHamllintAttributes(offense: LinterOffense) {
  const code = offense.linter_name;
  const rubocopLint = offense.linter_name === 'RuboCop';
  // A RuboCop message normally starts with `Cop/Name:`. When it does not, fall
  // back to the linter name instead of stringifying undefined.
  const matchedCop = rubocopLint ? offense.message.match(RUBOCOP_COP_NAME_REGEX)?.at(1) : undefined;
  const copName = matchedCop || code;

  let targetUri: Uri = Uri.parse(hamlCopUrl(code));
  let message = offense.message;

  if (rubocopLint && matchedCop) {
    targetUri = rubocopCopUrl(matchedCop);
  } else if (!rubocopLint) {
    message = `${code}: ${message}`;
  }

  return {
    message: message,
    source: rubocopLint ? 'RuboCop' : 'haml-lint',
    code: {
      value: copName,
      target: targetUri,
    },
  };
}

type DiagnosticCode = {
  value: string;
  target: Uri;
};

export class DiagnosticFull extends Diagnostic {
  code: DiagnosticCode;
  source: string;
  // True only when the server said so: haml_lint < 0.76 sends null.
  correctable: boolean;

  constructor(
    range: Range,
    message: string,
    code: DiagnosticCode,
    source: string,
    severity?: DiagnosticSeverity,
    correctable = false
  ) {
    super(range, message, severity);
    this.code = code;
    this.source = source;
    this.correctable = correctable;
  }
}

export function parseLintOffence(document: TextDocument, offense: LinterOffense): DiagnosticFull {
  // FinalNewline/TrailingEmptyLines report the line *after* the last one when the
  // file ends without a newline, and lineAt() throws outside the document.
  const line = Math.min(Math.max(offense.location.line - 1, 0), document.lineCount - 1);
  const lineText = document.lineAt(line);
  const lineTextRange = lineText.range;

  const range = new Range(new Position(lineTextRange.start.line, lineText.firstNonWhitespaceCharacterIndex), lineTextRange.end);

  const severity = offense.severity === 'warning' ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error;
  const { message, source, code } = parseHamllintAttributes(offense);

  const diagnostic = new DiagnosticFull(range, message, code, source, severity, offense.correctable === true);

  return diagnostic;
}
