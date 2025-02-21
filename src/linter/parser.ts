import { Diagnostic, DiagnosticSeverity, OutputChannel, Position, Range, TextDocument, Uri } from 'vscode';
import { LinterConfigWithErrors, LinterOffense } from '../types';
import { hamlCopUrl, rubocopUrl } from '../ultils/uris';

function parseRuboCopAttributes(offense: LinterOffense) {
  const copName = offense.message.match(/([A-Z]\w+\/[A-Z]\w+)/);
  const message = offense.message.replace(/\s\((https.*)\)$/, '');

  return {
    message: message,
    source: 'Rubocop',
    code: {
      value: copName ? copName[0] : '',
      target: Uri.parse(rubocopUrl(copName ? copName[0] : ''))
    }
  };
}

function parseHamllintAttributes(offense: LinterOffense) {
  const message = offense.message.replace(/\s\((https.*)\)$/, '');
  const code = offense.linter_name;

  return {
    message: message,
    source: 'haml-lint',
    code: {
      value: code,
      target: Uri.parse(hamlCopUrl(code))
    }
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

  const range = new Range(
    new Position(lineTextRange.start.line, lineText.firstNonWhitespaceCharacterIndex),
    lineTextRange.end
  );

  const severity = offense.severity === 'warning' ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error;
  const { message, source, code } = offense.linter_name === 'RuboCop' ? parseRuboCopAttributes(offense) : parseHamllintAttributes(offense);

  const diagnostic = new DiagnosticFull(range, message, code, source, severity);

  return diagnostic;
}

// show vs code notification error if config has errors
export function notifyErrors(configs: LinterConfigWithErrors, outputChanel: OutputChannel) {
  if (configs.haml_lint.error) {
    outputChanel.appendLine(`Haml-Lint: ${configs.haml_lint.error}`);
    outputChanel.show();
  }

  if (configs.rubocop.error) {
    outputChanel.appendLine(`RuboCop: ${configs.rubocop.error}`);
    outputChanel.show();
  }
}
