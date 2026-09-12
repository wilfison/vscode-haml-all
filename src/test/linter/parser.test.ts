import * as assert from 'assert';
import * as vscode from 'vscode';

import { parseLintOffence } from '../../linter/parser';
import { LinterOffense } from '../../types';

function offense(linterName: string, message: string, line: number, correctable?: boolean | null): LinterOffense {
  return {
    linter_name: linterName,
    location: { line },
    message,
    severity: 'warning',
    ...(correctable === undefined ? {} : { correctable }),
  };
}

async function hamlDocument(content: string): Promise<vscode.TextDocument> {
  return vscode.workspace.openTextDocument({ content, language: 'haml' });
}

suite('linter/parser Tests', () => {
  test('clamps an offense reported past the end of the document', async () => {
    const document = await hamlDocument('%p one\n%p two');
    const past = document.lineCount + 1;

    const diagnostic = parseLintOffence(document, offense('FinalNewline', 'Files should end with a newline', past));

    assert.strictEqual(diagnostic.range.start.line, document.lineCount - 1);
  });

  test('extracts the cop name from a RuboCop message', async () => {
    const document = await hamlDocument('%p{class: "a"}');

    const diagnostic = parseLintOffence(document, offense('RuboCop', 'Style/StringLiterals: Prefer single-quoted', 1));

    assert.strictEqual(diagnostic.code.value, 'Style/StringLiterals');
    assert.strictEqual(diagnostic.source, 'RuboCop');
  });

  test('falls back to the linter name when the RuboCop message has no cop name', async () => {
    const document = await hamlDocument('%p{class: "a"}');

    const diagnostic = parseLintOffence(document, offense('RuboCop', 'something went wrong', 1));

    assert.strictEqual(diagnostic.code.value, 'RuboCop');
    assert.ok(!diagnostic.code.value.includes('undefined'));
    assert.ok(!diagnostic.code.target.toString().includes('undefined'));
  });

  test('marks the diagnostic correctable only when the server says true', async () => {
    const document = await hamlDocument('%p  ');
    const parse = (correctable?: boolean | null) =>
      parseLintOffence(document, offense('TrailingWhitespace', 'trailing', 1, correctable)).correctable;

    assert.strictEqual(parse(true), true);
    assert.strictEqual(parse(false), false);
    // haml_lint < 0.76: the server sends null, or the key is missing entirely.
    assert.strictEqual(parse(null), false);
    assert.strictEqual(parse(undefined), false);
  });
});
