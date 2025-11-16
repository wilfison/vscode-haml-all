import { Diagnostic, DiagnosticSeverity, OutputChannel, Position, Range, TextDocument, Uri } from 'vscode';
import { LinterConfigWithErrors, LinterOffense } from '../types';
import { hamlCopUrl } from '../ultils/uris';

const RUBOCOP_COP_NAME_REGEX = /([\w\/]*):/;

function rubocopCopUrl(copName: string): Uri {
  const copModule = copName.toLowerCase().split('/')[0];
  const copAnchor = copName.toLowerCase().replace(/[^a-z0-9]+/g, '');

  return Uri.parse(`https://docs.rubocop.org/rubocop/cops_${copModule}.html#${copAnchor}`);
}

function parseHamllintAttributes(offense: LinterOffense) {
  const code = offense.linter_name;
  const rubocopLint = offense.linter_name === 'RuboCop';
  const copName = rubocopLint ? String(offense.message.match(RUBOCOP_COP_NAME_REGEX)?.at(1)) : code;

  let targetUri: Uri | undefined = Uri.parse(hamlCopUrl(code));
  let message = offense.message;

  if (rubocopLint) {
    targetUri = rubocopCopUrl(copName);
  } else {
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

  constructor(range: Range, message: string, code: DiagnosticCode, source: string, severity?: DiagnosticSeverity) {
    super(range, message, severity);
    this.code = code;
    this.source = source;
  }
}

export function parseLintOffence(document: TextDocument, offense: LinterOffense): DiagnosticFull {
  const line = Math.max(offense.location.line - 1, 0);
  const lineText = document.lineAt(line);
  const lineTextRange = lineText.range;

  const range = new Range(new Position(lineTextRange.start.line, lineText.firstNonWhitespaceCharacterIndex), lineTextRange.end);

  const severity = offense.severity === 'warning' ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error;
  const { message, source, code } = parseHamllintAttributes(offense);

  const diagnostic = new DiagnosticFull(range, message, code, source, severity);

  return diagnostic;
}

// show vs code notification error if config has errors
export function notifyErrors(configs: LinterConfigWithErrors, outputChanel: OutputChannel) {
  if (configs.haml_lint.error) {
    outputChanel.appendLine(`Haml-Lint: ${configs.haml_lint.error}`);
    outputChanel.show();
  }
}
