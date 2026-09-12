import * as assert from 'assert';
import * as vscode from 'vscode';

import { parseLintOffence } from '../../linter/parser';
import { LinterOffense } from '../../types';

function offense(linterName: string, message: string, line: number): LinterOffense {
  return {
    linter_name: linterName,
    location: { line },
    message,
    severity: 'warning',
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
});
