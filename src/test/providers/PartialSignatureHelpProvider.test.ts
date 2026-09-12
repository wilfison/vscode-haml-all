import * as assert from 'assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

import PartialSignatureHelpProvider from '../../providers/PartialSignatureHelpProvider';

// A view plus the partial it renders, so the provider can read the partial's
// `-# locals:` comment and build a signature with real parameters.
function createViews(locals: string): { viewPath: string; cleanup: () => void } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'haml-all-views-'));
  const viewsDir = path.join(root, 'app', 'views', 'users');

  fs.mkdirSync(viewsDir, { recursive: true });
  fs.writeFileSync(path.join(viewsDir, '_form.html.haml'), `-# locals: (${locals})\n`);

  const viewPath = path.join(viewsDir, 'index.html.haml');
  fs.writeFileSync(viewPath, '');

  return { viewPath, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

function documentFor(viewPath: string, lineContent: string): vscode.TextDocument {
  return {
    fileName: viewPath,
    languageId: 'haml',
    lineAt: () => ({ text: lineContent }),
  } as any;
}

function activeParameterFor(locals: string, lineContent: string): number {
  const { viewPath, cleanup } = createViews(locals);

  try {
    const provider = new PartialSignatureHelpProvider();
    const document = documentFor(viewPath, lineContent);
    const position = new vscode.Position(0, lineContent.length);

    const help = provider.provideSignatureHelp(document, position, null as any);

    assert.ok(help, 'expected signature help');
    return help.activeParameter;
  } finally {
    cleanup();
  }
}

suite('PartialSignatureHelpProvider Tests', () => {
  test('keeps the first parameter active with no comma typed', () => {
    assert.strictEqual(activeParameterFor('a:, b:, c:', "= render 'form'"), 0);
  });

  test('advances one parameter per comma', () => {
    assert.strictEqual(activeParameterFor('a:, b:, c:', "= render 'form', a: 1"), 1);
    assert.strictEqual(activeParameterFor('a:, b:, c:', "= render 'form', a: 1, b: 2"), 2);
    assert.strictEqual(activeParameterFor('a:, b:, c:', "= render 'form', a: 1, b: 2, c: 3"), 3);
  });

  test('never goes past the last parameter of the signature', () => {
    // 3 locals -> location + 3 parameters, so 3 is the highest valid index.
    assert.strictEqual(activeParameterFor('a:, b:, c:', "= render 'form', a: 1, b: 2, c: 3, d: 4, e: 5"), 3);
    assert.strictEqual(activeParameterFor('a:', "= render 'form', a: 1, b: 2, c: 3"), 1);
  });
});
