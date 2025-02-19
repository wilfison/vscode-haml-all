import { Diagnostic, DiagnosticSeverity, Position, Range, TextDocument, Uri } from 'vscode';
import { LinterOffense } from '../types';

function parseRuboCopAttributes(offense: LinterOffense) {
  const copUrl = offense.message.match(/\s\((https.*)\)$/);
  const copName = offense.message.match(/([A-Z]\w+\/[A-Z]\w+)/);
  const message = offense.message.replace(/\s\((https.*)\)$/, '');

  return {
    message: message,
    source: 'Rubocop',
    code: {
      value: copName ? copName[0] : '',
      target: Uri.parse(copUrl ? copUrl[1] : '')
    }
  };
}

function parseHamllintAttributes(offense: LinterOffense) {
  const baseURL = 'https://github.com/sds/haml-lint/blob/main/lib/haml_lint/linter/README.md';
  const message = offense.message.replace(/\s\((https.*)\)$/, '');
  const code = offense.linter_name;

  return {
    message: message,
    source: 'haml-lint',
    code: {
      value: code,
      target: Uri.parse(`${baseURL}#${code}`)
    }
  };
}

export function parseLintOffence(document: TextDocument, offense: LinterOffense): Diagnostic {
  const line = Math.max(offense.location.line - 1, 0);
  const lineText = document.lineAt(line);
  const lineTextRange = lineText.range;

  const range = new Range(
    new Position(lineTextRange.start.line, lineText.firstNonWhitespaceCharacterIndex),
    lineTextRange.end
  );

  const severity = offense.severity === 'warning' ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error;
  const copAttributes = offense.linter_name === 'RuboCop' ? parseRuboCopAttributes(offense) : parseHamllintAttributes(offense);
  const diagnostic = new Diagnostic(range, copAttributes.message, severity);

  diagnostic.code = copAttributes.code;
  diagnostic.source = copAttributes.source;

  return diagnostic;
}